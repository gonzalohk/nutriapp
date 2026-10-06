import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, errorOf, type TestDb } from './harness'

let db: TestDb
let alice: string
let bob: string
let eve: string

const as = <T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) =>
  db.asUser(user, async () => (await db.pg.query<T>(sql, params)).rows)

beforeAll(async () => {
  db = await createDb()
  alice = await db.createUser()
  bob = await db.createUser()
  eve = await db.createUser()
  await as(alice, `select create_household('Casa', 'Alice')`)
  const code = (await as<{ create_invite: string }>(alice, `select create_invite()`))[0]!.create_invite
  await as(bob, `select join_household($1, 'Bob')`, [code])
  await db.asAdmin(async () => {
    const h = await db.pg.query<{ id: string }>(`insert into households (name) values ('Otra') returning id`)
    await db.pg.query(`insert into household_members (household_id, user_id, role, display_name) values ($1,$2,'owner','Eve')`, [h.rows[0]!.id, eve])
  })
})

afterAll(async () => db.close())

describe('create_person', () => {
  it('creates the person and the first plan terms together (20 meals, Monday to Friday)', async () => {
    const [p] = await as<{ id: string; first_name: string; active: boolean }>(alice, `select * from create_person('Ana', 'Pérez', '2026-10-15')`)
    expect(p).toMatchObject({ first_name: 'Ana', active: true })
    const terms = await as(alice, `select effective_from::text, meals_per_month, delivery_weekdays from plan_terms where person_id = $1`, [p!.id])
    expect(terms).toEqual([{ effective_from: '2026-10-01', meals_per_month: 20, delivery_weekdays: [1, 2, 3, 4, 5] }])
  })

  it('a mid-month start still gets the terms of its first month (spec Edge Case 1)', async () => {
    const [p] = await as<{ id: string }>(alice, `select * from create_person('Beto', null, '2026-11-18', 25)`)
    const terms = await as(alice, `select effective_from::text, meals_per_month from plan_terms where person_id = $1`, [p!.id])
    expect(terms).toEqual([{ effective_from: '2026-11-01', meals_per_month: 25 }])
  })

  it('rolls back completely when the terms are invalid (no person without terms)', async () => {
    const before = (await as<{ n: number }>(alice, `select count(*)::int as n from people`))[0]!.n
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`select * from create_person('Mal', null, '2026-10-01', 0)`)))
    expect(err).toContain('check')
    expect((await as<{ n: number }>(alice, `select count(*)::int as n from people`))[0]!.n).toBe(before)
  })

  it('rejects a blank name', async () => {
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`select * from create_person('  ', null, '2026-10-01')`)))).toContain('check')
  })

  it('adds a person to the caller\'s household only, visible to every member', async () => {
    const names = (await as<{ first_name: string }>(bob, `select first_name from people order by first_name`)).map((r) => r.first_name)
    expect(names).toEqual(['Ana', 'Beto'])
    expect(await as(eve, `select * from people`)).toHaveLength(0)
  })

  it('requires a household and a signed-in caller', async () => {
    expect(await errorOf(db.pg.query(`select * from create_person('X', null, '2026-10-01')`))).toContain('E_NOT_AUTHENTICATED')
  })
})

describe('deactivating people (spec FR-007)', () => {
  it('keeps the person and their meals readable when they are deactivated', async () => {
    const [p] = await as<{ id: string }>(alice, `select id from people where first_name = 'Ana'`)
    await db.asAdmin(async () => {
      const plan = await db.pg.query<{ id: string }>(`insert into monthly_plans (person_id, household_id, month, contracted_count) select id, household_id, '2026-10-01', 20 from people where id = $1 returning id`, [p!.id])
      await db.pg.query(`insert into meals (monthly_plan_id, person_id, household_id, meal_date) select $1, $2, household_id, '2026-10-16' from people where id = $2`, [plan.rows[0]!.id, p!.id])
    })
    await as(bob, `update people set active = false, plan_end_date = '2026-10-15' where id = $1`, [p!.id])
    expect(await as(alice, `select active from people where id = $1`, [p!.id])).toEqual([{ active: false }])
    expect(await as(alice, `select 1 from meals where person_id = $1`, [p!.id])).toHaveLength(1)
  })

  it('can be undone: reactivating clears the end date', async () => {
    const [p] = await as<{ id: string }>(alice, `select id from people where first_name = 'Ana'`)
    await as(alice, `update people set active = true, plan_end_date = null where id = $1`, [p!.id])
    expect(await as(alice, `select active, plan_end_date from people where id = $1`, [p!.id])).toEqual([{ active: true, plan_end_date: null }])
  })

  it('refuses an end date before the start date', async () => {
    const [p] = await as<{ id: string }>(alice, `select id from people where first_name = 'Ana'`)
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`update people set plan_end_date = '2020-01-01' where id = $1`, [p!.id])))).toContain('check')
  })

  it('cannot delete a person at all', async () => {
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`delete from people`)))).toContain('permission denied')
  })
})
