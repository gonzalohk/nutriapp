import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, errorOf, type TestDb } from './harness'

let db: TestDb
beforeAll(async () => { db = await createDb() })
afterAll(async () => db.close())

const rows = async <T extends object>(sql: string) => (await db.asAdmin(() => db.pg.query<T>(sql))).rows

describe('security review (spec FR-001, FR-002, FR-024)', () => {
  it('every table in the public schema has Row Level Security enabled', async () => {
    const tables = await rows<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`)
    expect(tables.length).toBeGreaterThanOrEqual(13)
    expect(tables.filter((t) => !t.rowsecurity).map((t) => t.tablename)).toEqual([])
  })

  it('every public table has at least one policy (no table is silently closed or forgotten)', async () => {
    const missing = await rows<{ tablename: string }>(
      `select t.tablename from pg_tables t where t.schemaname = 'public'
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)`)
    expect(missing).toEqual([])
  })

  it('the anonymous role has no access to any public table', async () => {
    const grants = await rows<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`)
    expect(grants).toEqual([])
  })

  it('the anonymous role cannot execute any of the app functions', async () => {
    const fns = await rows<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
         and p.proname not in ('bolivia_today', 'try_uuid', 'touch_updated_at', 'meals_validate_date', 'meals_log_status', 'exceptional_delivery_validate')`)
    expect(fns).toEqual([])
  })

  it('security-definer functions pin their search_path (no schema hijacking)', async () => {
    const unsafe = await rows<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))`)
    expect(unsafe).toEqual([])
  })

  it('the photo bucket is private, size-limited and restricted to webp and jpeg', async () => {
    const [b] = await rows<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit::text, allowed_mime_types from storage.buckets where id = 'meal-photos'`)
    expect(b).toEqual({ public: false, file_size_limit: '2097152', allowed_mime_types: ['image/webp', 'image/jpeg'] })
  })

  it('a freshly signed-up account with no household sees no data and cannot create meals', async () => {
    const stranger = await db.createUser()
    for (const table of ['households', 'people', 'meals', 'meal_photos', 'meal_status_changes', 'monthly_plans', 'plan_terms', 'holiday_overrides']) {
      const n = await db.asUser(stranger, async () => (await db.pg.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n)
      expect(n, table).toBe(0)
    }
    const err = await db.asUser(stranger, () => errorOf(db.pg.query(`select * from set_meal_status(gen_random_uuid(), 'picked_up', null, null, null)`)))
    expect(err).toContain('E_NOT_FOUND')
    const person = await db.asUser(stranger, () => errorOf(db.pg.query(`select * from create_person('X', null, '2026-10-01')`)))
    expect(person).toContain('E_FORBIDDEN')
  })

  it('the official holiday data cannot be changed from the app', async () => {
    const user = await db.createUser()
    const err = await db.asUser(user, () => errorOf(db.pg.query(`delete from official_holidays`)))
    expect(err).toContain('permission denied')
  })
})
