import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * Minimal stand-ins for the parts of Supabase the migrations rely on, so the real migration
 * files can run on an embedded Postgres without Docker.
 */
export const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  -- Same lookup as Supabase: the legacy per-claim setting first, then the JSON claims PostgREST sets.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  create schema extensions;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz not null default now()
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  grant usage on schema public, auth, storage to anon, authenticated;
  grant select on auth.users to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')

export interface TestDb {
  pg: PGlite
  /** Create a user in the auth stub and return its id. */
  createUser(email?: string): Promise<string>
  /** Run `fn` with the session acting as `userId` under the `authenticated` role (RLS applies). */
  asUser<T>(userId: string, fn: () => Promise<T>): Promise<T>
  /** Run statements as the table owner (bypasses RLS) for fixtures. */
  asAdmin<T>(fn: () => Promise<T>): Promise<T>
  close(): Promise<void>
}

export async function createDb(): Promise<TestDb> {
  const pg = new PGlite()
  await pg.exec(SUPABASE_STUB)

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }

  const asAdmin = async <T>(fn: () => Promise<T>): Promise<T> => {
    await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
    return fn()
  }

  return {
    pg,
    async createUser(email = `user-${Math.random().toString(36).slice(2)}@example.com`) {
      const res = await pg.query<{ id: string }>(
        `insert into auth.users (email) values ($1) returning id`,
        [email],
      )
      return res.rows[0]!.id
    },
    async asUser(userId, fn) {
      await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`)
      try {
        return await fn()
      } finally {
        await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
      }
    },
    asAdmin,
    close: () => pg.close(),
  }
}

/** Error message of a rejected query, for asserting stable error codes such as `E_INVALID_DATE`. */
export async function errorOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
