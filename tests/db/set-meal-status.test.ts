import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, errorOf, type TestDb } from './harness'

let db: TestDb
let alice: string
let bob: string
let eve: string
let person: string
let meal: string // a scheduled meal on a past date
let otherHouseholdMeal: string

const call = (user: string, sql: string, params: unknown[] = []) =>
  db.asUser(user, async () => (await db.pg.query<Record<string, unknown>>(sql, params)).rows)

const setStatus = (user: string, id: string, status: string, note: string | null = null, reason: string | null = null, ts: string | null = null) =>
  call(user, `select * from set_meal_status($1, $2::meal_status, $3, $4, $5::timestamptz)`, [id, status, note, reason, ts])

const logOf = async (id: string) =>
  (await db.asAdmin(() => db.pg.query<{ from_status: string; to_status: string; changed_by: string }>(
    `select from_status::text, to_status::text, changed_by from meal_status_changes where meal_id = $1 order by id`, [id]))).rows

beforeAll(async () => {
  db = await createDb()
  alice = await db.createUser('alice@example.com')
  bob = await db.createUser('bob@example.com')
  eve = await db.createUser('eve@example.com')
  const hid = (await call(alice, `select create_household('Casa','Alice') as id`))[0]!.id as string
  const code = (await call(alice, `select create_invite() as code`))[0]!.code as string
  await call(bob, `select join_household($1, 'Bob')`, [code])
  const hb = await db.asAdmin(async () => {
    const h = await db.pg.query<{ id: string }>(`insert into households (name) values ('Casa B') returning id`)
    await db.pg.query(`insert into household_members (household_id, user_id, role, display_name) values ($1,$2,'owner','Eve')`, [h.rows[0]!.id, eve])
    return h.rows[0]!.id
  })
  const mk = async (household: string, name: string) =>
    (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into people (household_id, first_name, plan_start_date) values ($1,$2,'2024-01-01') returning id`, [household, name]))).rows[0]!.id
  person = await mk(hid, 'Ana')
  const personB = await mk(hb, 'Zoe')
  const plan = async (p: string, h: string) =>
    (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into monthly_plans (person_id, household_id, month, contracted_count) values ($1,$2,'2026-01-01',20) returning id`, [p, h]))).rows[0]!.id
  const planA = await plan(person, hid)
  const planB = await plan(personB, hb)
  const ins = async (p: string, h: string, pl: string, date: string) =>
    (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into meals (monthly_plan_id, person_id, household_id, meal_date) values ($1,$2,$3,$4) returning id`, [pl, p, h, date]))).rows[0]!.id
  meal = await ins(person, hid, planA, '2026-01-05')
  otherHouseholdMeal = await ins(personB, hb, planB, '2026-01-05')
})

afterAll(async () => db.close())

describe('set_meal_status', () => {
  it('records an outcome and logs scheduled -> picked_up with who and when', async () => {
    const [row] = await setStatus(alice, meal, 'picked_up')
    expect(row).toMatchObject({ status: 'picked_up' })
    expect(await logOf(meal)).toEqual([{ from_status: 'scheduled', to_status: 'picked_up', changed_by: alice }])
  })

  it('treats the same status again as a no-op: no new log entry, same timestamp', async () => {
    const before = (await call(alice, `select status_changed_at::text as t from meals where id = $1`, [meal]))[0]!.t
    await setStatus(alice, meal, 'picked_up')
    const after = (await call(alice, `select status_changed_at::text as t from meals where id = $1`, [meal]))[0]!.t
    expect(after).toBe(before)
    expect(await logOf(meal)).toHaveLength(1)
  })

  it('lets another adult correct it and attributes the change to them', async () => {
    await setStatus(bob, meal, 'not_picked_up')
    await setStatus(bob, meal, 'picked_up')
    const log = await logOf(meal)
    expect(log.map((l) => `${l.from_status}>${l.to_status}`)).toEqual([
      'scheduled>picked_up', 'picked_up>not_picked_up', 'not_picked_up>picked_up',
    ])
    expect(log.at(-1)!.changed_by).toBe(bob)
  })

  it('never lets a user choose "scheduled"', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`select * from set_meal_status($1, 'scheduled', null, null, null)`, [meal])))
    expect(err).toContain('E_INVALID_STATUS')
  })

  it('stores a permission reason only with the permission status', async () => {
    const [perm] = await setStatus(alice, meal, 'permission', 'Viaje', 'Estaré fuera')
    expect(perm).toMatchObject({ status: 'permission', note: 'Viaje', permission_reason: 'Estaré fuera' })
    const [back] = await setStatus(alice, meal, 'cancelled', null, 'ignorado')
    expect(back).toMatchObject({ status: 'cancelled', permission_reason: null, note: 'Viaje' })
  })

  it('updates only the note when the status is unchanged, without a log entry', async () => {
    const n = (await logOf(meal)).length
    const [row] = await setStatus(alice, meal, 'cancelled', 'Cancelada por teléfono')
    expect(row).toMatchObject({ status: 'cancelled', note: 'Cancelada por teléfono' })
    expect(await logOf(meal)).toHaveLength(n)
    const [cleared] = await setStatus(alice, meal, 'cancelled', '')
    expect(cleared).toMatchObject({ note: null })
  })

  it('ignores a queued change older than the current one (offline replay safety)', async () => {
    await db.asAdmin(() => db.pg.query(`update meals set status = 'scheduled', status_changed_at = '2026-01-01T00:00:00Z' where id = $1`, [meal]))
    await setStatus(alice, meal, 'picked_up', null, null, '2026-01-06T10:00:00Z')
    const [stale] = await setStatus(bob, meal, 'not_picked_up', null, null, '2026-01-06T09:00:00Z')
    expect(stale).toMatchObject({ status: 'picked_up' })
  })

  it('applies queued changes from one device in order, even though sync happens later', async () => {
    await db.asAdmin(() => db.pg.query(`update meals set status = 'scheduled', status_changed_at = '2026-01-05T00:00:00Z' where id = $1`, [meal]))
    await setStatus(alice, meal, 'not_picked_up', null, null, '2026-01-05T12:00:00Z')
    const [second] = await setStatus(alice, meal, 'picked_up', null, null, '2026-01-05T12:30:00Z')
    expect(second).toMatchObject({ status: 'picked_up' })
  })

  it('clamps a client timestamp from the future to now', async () => {
    await setStatus(alice, meal, 'cancelled', null, null, '2999-01-01T00:00:00Z')
    const r = await call(alice, `select (status_changed_at <= now()) as ok from meals where id = $1`, [meal])
    expect(r[0]!.ok).toBe(true)
  })

  it('keeps the updated_at timestamp moving (RULE-016)', async () => {
    const r = await call(alice, `select (updated_at >= created_at) as ok from meals where id = $1`, [meal])
    expect(r[0]!.ok).toBe(true)
  })

  it('does not reveal or change another household\'s meal (E_NOT_FOUND)', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`select * from set_meal_status($1, 'picked_up', null, null, null)`, [otherHouseholdMeal])))
    expect(err).toContain('E_NOT_FOUND')
    const log = await logOf(otherHouseholdMeal)
    expect(log).toHaveLength(0)
  })

  it('shows the change log only to the household', async () => {
    const mine = await call(alice, `select count(*)::int as n from meal_status_changes where meal_id = $1`, [meal])
    expect(mine[0]!.n).toBeGreaterThan(0)
    const theirs = await call(eve, `select count(*)::int as n from meal_status_changes where meal_id = $1`, [meal])
    expect(theirs[0]!.n).toBe(0)
  })

  it('requires a signed-in caller', async () => {
    const err = await errorOf(db.pg.query(`select * from set_meal_status($1, 'picked_up', null, null, null)`, [meal]))
    expect(err).toContain('E_NOT_AUTHENTICATED')
  })
})
