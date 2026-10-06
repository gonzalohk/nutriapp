import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createServer, request, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type pg from 'pg'

/**
 * A tiny stand-in for Supabase's Auth (GoTrue) and Storage APIs, plus a proxy to PostgREST, so the
 * whole app can run on a laptop without Docker. DEVELOPMENT ONLY: passwords live in memory and files
 * are not checked against the storage policies (those are covered by the database tests).
 */
export interface DevApiOptions {
  port: number
  restPort: number
  jwtSecret: string
  db: pg.Client
}

const b64 = (v: Buffer | string) => Buffer.from(v).toString('base64url')

export function signJwt(secret: string, claims: Record<string, unknown>, ttlSeconds = 3600): string {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = b64(JSON.stringify({ aud: 'authenticated', exp, ...claims }))
  return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`
}

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-upsert,prefer,accept-profile,content-profile,range,cache-control,accept',
  'access-control-expose-headers': 'content-range,content-length',
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  const isBuffer = Buffer.isBuffer(body)
  res.writeHead(status, { ...CORS, 'content-type': isBuffer ? 'application/octet-stream' : 'application/json', ...headers })
  res.end(body === undefined ? undefined : isBuffer ? body : JSON.stringify(body))
}

export function startDevApi({ port, restPort, jwtSecret, db }: DevApiOptions): Promise<Server> {
  const passwords = new Map<string, string>() // email -> password
  const refreshTokens = new Map<string, string>() // refresh token -> user id
  const files = new Map<string, { bytes: Buffer; type: string }>() // storage path -> file

  const userJson = (id: string, email: string) => ({
    id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString(),
  })

  function session(id: string, email: string) {
    const refresh = randomBytes(16).toString('hex')
    refreshTokens.set(refresh, id)
    const expiresIn = 3600
    return {
      access_token: signJwt(jwtSecret, { role: 'authenticated', sub: id, email }, expiresIn),
      token_type: 'bearer', expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      refresh_token: refresh, user: userJson(id, email),
    }
  }

  async function userByEmail(email: string) {
    return (await db.query<{ id: string }>('select id from auth.users where email = $1', [email])).rows[0]
  }

  async function auth(req: IncomingMessage, res: ServerResponse, path: string, url: URL) {
    const body = JSON.parse((await readBody(req)).toString() || '{}') as Record<string, string>
    if (path === '/signup' && req.method === 'POST') {
      const email = String(body.email ?? '').toLowerCase()
      if (!email || (body.password ?? '').length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' })
      if (await userByEmail(email)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' })
      const id = randomUUID()
      await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
      passwords.set(email, body.password!)
      return send(res, 200, session(id, email))
    }
    if (path === '/token' && req.method === 'POST') {
      const grant = url.searchParams.get('grant_type')
      if (grant === 'password') {
        const email = String(body.email ?? '').toLowerCase()
        const user = await userByEmail(email)
        if (!user || passwords.get(email) !== body.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
        return send(res, 200, session(user.id, email))
      }
      if (grant === 'refresh_token') {
        const id = refreshTokens.get(body.refresh_token ?? '')
        if (!id) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' })
        const email = (await db.query<{ email: string }>('select email from auth.users where id = $1', [id])).rows[0]!.email
        return send(res, 200, session(id, email))
      }
    }
    if (path === '/user') {
      const token = (req.headers.authorization ?? '').replace('Bearer ', '')
      const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? 'e30', 'base64url').toString()) as { sub?: string; email?: string }
      return claims.sub ? send(res, 200, userJson(claims.sub, claims.email ?? '')) : send(res, 401, { code: 401, msg: 'invalid JWT' })
    }
    if (path === '/logout') return send(res, 204, undefined)
    return send(res, 404, { msg: 'not implemented in the dev stack' })
  }

  async function storage(req: IncomingMessage, res: ServerResponse, path: string) {
    const body = await readBody(req)
    const base = 'http://localhost:' + port
    // Upload: POST/PUT /object/{bucket}/{path}
    let m = /^\/object\/meal-photos\/(.+)$/.exec(path)
    if (m && (req.method === 'POST' || req.method === 'PUT')) {
      files.set(decodeURIComponent(m[1]!), { bytes: body, type: String(req.headers['content-type'] ?? 'application/octet-stream') })
      return send(res, 200, { Key: `meal-photos/${m[1]}`, Id: randomUUID() })
    }
    // Delete many: DELETE /object/{bucket} {prefixes: [...]}
    if (path === '/object/meal-photos' && req.method === 'DELETE') {
      const { prefixes } = JSON.parse(body.toString() || '{}') as { prefixes: string[] }
      for (const p of prefixes ?? []) files.delete(p)
      return send(res, 200, (prefixes ?? []).map((name) => ({ name })))
    }
    // Sign many: POST /object/sign/{bucket} {paths}
    if (path === '/object/sign/meal-photos' && req.method === 'POST') {
      const { paths } = JSON.parse(body.toString() || '{}') as { paths: string[] }
      return send(res, 200, paths.map((p) => files.has(p)
        ? { error: null, path: p, signedURL: `/object/sign/meal-photos/${encodeURI(p)}?token=${randomBytes(8).toString('hex')}` }
        : { error: 'Object not found', path: p, signedURL: null }))
    }
    // Sign one: POST /object/sign/{bucket}/{path}
    m = /^\/object\/sign\/meal-photos\/(.+)$/.exec(path)
    if (m && req.method === 'POST') return send(res, 200, { signedURL: `/object/sign/meal-photos/${m[1]}?token=${randomBytes(8).toString('hex')}` })
    // Download through a signed URL
    if (m && req.method === 'GET') {
      const file = files.get(decodeURIComponent(m[1]!))
      if (!file) return send(res, 404, { error: 'not found' })
      return send(res, 200, file.bytes, { 'content-type': file.type, 'cache-control': 'private, max-age=3600' })
    }
    void base
    return send(res, 404, { msg: 'not implemented in the dev stack' })
  }

  const server = createServer(async (req, res) => {
    // Answer preflights by allowing whatever headers the browser asks for (development only).
    if (req.method === 'OPTIONS') {
      const asked = req.headers['access-control-request-headers']
      return send(res, 204, undefined, asked ? { 'access-control-allow-headers': String(asked) } : {})
    }
    const url = new URL(req.url ?? '/', 'http://x')
    try {
      if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url.pathname.slice('/auth/v1'.length), url)
      if (url.pathname.startsWith('/storage/v1')) return await storage(req, res, url.pathname.slice('/storage/v1'.length))
      if (url.pathname.startsWith('/rest/v1')) {
        const upstream = request(
          { host: '127.0.0.1', port: restPort, path: url.pathname.slice('/rest/v1'.length) + url.search, method: req.method, headers: req.headers },
          (up) => {
            const headers = Object.fromEntries(Object.entries(up.headers).filter(([k]) => !k.startsWith('access-control-')))
            res.writeHead(up.statusCode ?? 502, { ...headers, ...CORS })
            up.pipe(res)
          },
        )
        upstream.on('error', () => send(res, 502, { message: 'PostgREST unavailable' }))
        req.pipe(upstream)
        return
      }
      send(res, 404, { msg: 'not found' })
    } catch (error) {
      send(res, 500, { msg: error instanceof Error ? error.message : 'error' })
    }
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}
