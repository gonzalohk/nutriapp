import { createHmac, randomUUID } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer, request, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { MIGRATIONS_DIR, SUPABASE_STUB } from '../db/harness'

/**
 * A real PostgreSQL plus a real PostgREST, with the project migrations applied. It checks what the
 * PGlite tests cannot: that the exact queries and function calls the app makes work through the same
 * REST layer Supabase uses. Auth (GoTrue) and Storage are not part of it.
 */
export interface Stack {
  /** Base URL the Supabase client can use (it appends /rest/v1). */
  url: string
  pgPort: number
  /** PostgREST's own port (the REST API without the /rest/v1 prefix). */
  restPort: number
  jwtSecret: string
  db: pg.Client
  createUser(email: string): Promise<string>
  mintJwt(userId: string): string
  stop(): Promise<void>
}

const POSTGREST = join(import.meta.dirname, '..', '..', '.cache', 'postgrest', 'postgrest')

const b64 = (input: Buffer | string) => Buffer.from(input).toString('base64url')

export function mintJwt(secret: string, userId: string): string {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64(JSON.stringify({ role: 'authenticated', sub: userId, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }))
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, () => {
      const port = (server.address() as { port: number }).port
      server.close(() => resolve(port))
    })
  })
}

function waitForPostgrest(port: number): Promise<void> {
  const deadline = Date.now() + 20_000
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = request({ host: '127.0.0.1', port, path: '/', timeout: 1000 }, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => (Date.now() > deadline ? reject(new Error('PostgREST did not start')) : setTimeout(attempt, 250)))
      req.end()
    }
    attempt()
  })
}

export interface StackOptions {
  /** Serve the REST API through a small proxy on a random port (default). Off: only PostgREST runs. */
  proxy?: boolean
}

export async function startStack(options: StackOptions = {}): Promise<Stack> {
  if (!existsSync(POSTGREST)) {
    throw new Error('PostgREST binary missing. Run: pnpm integration:setup')
  }
  const dataDir = mkdtempSync(join(tmpdir(), 'nutrilara-pg-'))
  const pgPort = await freePort()
  const embedded = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: pgPort, persistent: false, onLog: () => undefined, onError: () => undefined })
  await embedded.initialise()
  await embedded.start()
  await embedded.createDatabase('app')

  const db = new pg.Client({ host: '127.0.0.1', port: pgPort, user: 'postgres', password: 'postgres', database: 'app' })
  await db.connect()
  await db.query(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  await db.query(`
    create role authenticator login password 'authenticator' noinherit;
    grant anon, authenticated, service_role to authenticator;
  `)

  const jwtSecret = 'integration-test-secret-integration-test-secret'
  const restPort = await freePort()
  const postgrest: ChildProcess = spawn(POSTGREST, [], {
    env: {
      PGRST_DB_URI: `postgres://authenticator:authenticator@127.0.0.1:${pgPort}/app`,
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: jwtSecret,
      PGRST_SERVER_HOST: '127.0.0.1',
      PGRST_SERVER_PORT: String(restPort),
      PGRST_DB_POOL: '3',
    },
    stdio: 'ignore',
  })
  await waitForPostgrest(restPort)

  // supabase-js talks to <url>/rest/v1/...; PostgREST serves from the root, so strip the prefix.
  const proxy: Server = createServer((req, res) => {
    const target = (req.url ?? '/').replace(/^\/rest\/v1/, '') || '/'
    const upstream = request({ host: '127.0.0.1', port: restPort, path: target, method: req.method, headers: req.headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    })
    upstream.on('error', () => {
      res.writeHead(502)
      res.end()
    })
    req.pipe(upstream)
  })
  const proxyPort = await freePort()
  if (options.proxy !== false) await new Promise<void>((resolve) => proxy.listen(proxyPort, '127.0.0.1', resolve))

  return {
    url: `http://127.0.0.1:${proxyPort}`,
    pgPort,
    restPort,
    jwtSecret,
    db,
    async createUser(email) {
      const id = randomUUID()
      await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email])
      return id
    },
    mintJwt: (userId) => mintJwt(jwtSecret, userId),
    async stop() {
      if (proxy.listening) proxy.close()
      postgrest.kill('SIGTERM')
      await db.end().catch(() => undefined)
      await embedded.stop().catch(() => undefined)
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}
