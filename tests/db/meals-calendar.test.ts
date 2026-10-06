import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, errorOf, type TestDb } from './harness'

let db: TestDb
let alice: string
let eve: string // member of a second household
let householdA: string
let personA: string // Ana, Alice's household
let personB: string // Zoe, Eve's household

const rpc = <T = unknown>(user: string, sql: string, params: unknown[] = []) =>
  db.asUser(user, async () => (await db.pg.query<T>(sql, params)).rows)

const insertMeal = (person: string, household: string, plan: string, date: string) =>
  errorOf(
    db.asAdmin(() =>
      db.pg.query(`insert into meals (monthly_plan_id, person_id, household_id, meal_date) values ($1, $2, $3, $4)`, [plan, person, household, date]),
    ),
  )

async function newPlan(person: string, month = '2026-10-01') {
  const r = await db.asAdmin(() =>
    db.pg.query<{ id: string }>(
      `insert into monthly_plans (person_id, household_id, month, contracted_count)
       select id, household_id, $2::date, 20 from people where id = $1 on conflict (person_id, month) do update set contracted_count = 20 returning id`,
      [person, month],
    ),
  )
  return r.rows[0]!.id
}

beforeAll(async () => {
  db = await createDb()
  alice = await db.createUser('alice@example.com')
  eve = await db.createUser('eve@example.com')
  householdA = (await rpc<{ create_household: string }>(alice, `select create_household('Casa A','Alice')`))[0]!.create_household
  const hb = await db.asAdmin(async () => {
    const h = await db.pg.query<{ id: string }>(`insert into households (name) values ('Casa B') returning id`)
    await db.pg.query(`insert into household_members (household_id, user_id, role, display_name) values ($1,$2,'owner','Eve')`, [h.rows[0]!.id, eve])
    return h.rows[0]!.id
  })
  const mk = async (hid: string, name: string) =>
    (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into people (household_id, first_name, plan_start_date) values ($1,$2,'2024-01-01') returning id`, [hid, name]))).rows[0]!.id
  personA = await mk(householdA, 'Ana')
  personB = await mk(hb, 'Zoe')
})

afterAll(async () => db.close())

describe('holiday data', () => {
  it('ships Bolivian public holidays and the covered year range', async () => {
    const r = await db.asAdmin(() => db.pg.query<{ n: number; first_year: number; last_year: number }>(
      `select (select count(*)::int from official_holidays) as n, first_year, last_year from official_holiday_years where country_code = 'BO'`))
    expect(r.rows[0]!.first_year).toBe(2024)
    expect(r.rows[0]!.last_year).toBe(2045)
    expect(r.rows[0]!.n).toBeGreaterThan(200)
  })

  it('includes the movable and shifted holidays of 2026', async () => {
    const r = await rpc<{ holiday_date: string }>(alice, `select holiday_date::text from effective_holidays where holiday_date between '2026-01-01' and '2026-12-31' order by holiday_date`)
    expect(r.map((x) => x.holiday_date)).toContain('2026-02-16')
    expect(r.map((x) => x.holiday_date)).toContain('2026-06-22')
    expect(r).toHaveLength(12)
  })
})

describe('meals only on valid days (RULE-004, 005, 013, 014)', () => {
  let plan: string
  beforeAll(async () => { plan = await newPlan(personA) })

  it('accepts a normal weekday', async () => {
    expect(await insertMeal(personA, householdA, plan, '2026-10-01')).toBeNull()
  })

  it('rejects a Saturday', async () => {
    expect(await insertMeal(personA, householdA, plan, '2026-10-03')).toContain('E_INVALID_DATE')
  })

  it('rejects a Sunday', async () => {
    expect(await insertMeal(personA, householdA, plan, '2026-10-04')).toContain('E_INVALID_DATE')
  })

  it('rejects a Bolivian holiday on a weekday (Carnival Monday)', async () => {
    const febPlan = await newPlan(personA, '2026-02-01')
    expect(await insertMeal(personA, householdA, febPlan, '2026-02-16')).toContain('E_INVALID_DATE')
  })

  it('rejects the same person and date twice (RULE-012)', async () => {
    expect(await insertMeal(personA, householdA, plan, '2026-10-01')).toContain('unique')
  })

  it('allows a Saturday once the household registers it as an exceptional delivery', async () => {
    await rpc(alice, `select add_exceptional_delivery('2026-10-10', 'Entrega extra')`)
    expect(await insertMeal(personA, householdA, plan, '2026-10-10')).toBeNull()
  })

  it('does not allow an exceptional delivery on a holiday', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`select add_exceptional_delivery('2026-02-16', null)`)))
    expect(err).toContain('E_INVALID_DATE')
  })

  it('treats a custom holiday as a non-delivery day and lets a suppressed one deliver', async () => {
    await rpc(alice, `select add_holiday('2026-10-14', 'Feriado local')`)
    expect(await insertMeal(personA, householdA, plan, '2026-10-14')).toContain('E_INVALID_DATE')
    await rpc(alice, `select remove_holiday('2026-10-14')`)
    expect(await insertMeal(personA, householdA, plan, '2026-10-14')).toBeNull()

    await rpc(alice, `select remove_holiday('2026-02-17')`)
    const febPlan = await newPlan(personA, '2026-02-01')
    expect(await insertMeal(personA, householdA, febPlan, '2026-02-17')).toBeNull()
  })

  it('keeps holiday changes private to the household', async () => {
    const eves = await rpc<{ holiday_date: string }>(eve, `select holiday_date::text from effective_holidays where holiday_date = '2026-02-17'`)
    expect(eves).toHaveLength(1) // still a holiday for the other household
  })

  it('returns the months a holiday change may affect so the UI can reconcile', async () => {
    const added = await rpc<{ add_holiday: Array<{ person_id: string; month: string }> }>(alice, `select add_holiday('2026-10-01', 'Prueba')`)
    expect(added[0]!.add_holiday).toEqual([{ person_id: personA, month: '2026-10-01' }])
    const removed = await rpc<{ remove_holiday: Array<{ person_id: string; month: string }> }>(alice, `select remove_holiday('2026-10-01')`)
    expect(removed[0]!.remove_holiday).toEqual([{ person_id: personA, month: '2026-10-01' }])
  })
})

describe('apply_month_plan', () => {
  const apply = (user: string, person: string, month: string, dates: string[], contracted = 20, partial = false) =>
    rpc<{ apply_month_plan: string }>(user, `select apply_month_plan($1, $2, $3::date[], $4, $5)`, [person, month, dates, contracted, partial])

  const mealDates = async (person: string, month: string) =>
    (await db.asAdmin(() => db.pg.query<{ meal_date: string }>(
      `select meal_date::text from meals m join monthly_plans p on p.id = m.monthly_plan_id where p.person_id = $1 and p.month = $2 order by meal_date`, [person, month]))).rows.map((r) => r.meal_date)

  it('creates the plan and its meals, numbered by date', async () => {
    const dates = ['2026-03-02', '2026-03-03', '2026-03-04']
    const id = (await apply(alice, personA, '2026-03-01', dates))[0]!.apply_month_plan
    expect(id).toBeTruthy()
    expect(await mealDates(personA, '2026-03-01')).toEqual(dates)
    const numbered = await rpc<{ meal_date: string; meal_no: number }>(alice, `select meal_date::text, meal_no from meals_numbered where monthly_plan_id = $1 order by meal_no`, [id])
    expect(numbered.map((r) => r.meal_no)).toEqual([1, 2, 3])
  })

  it('is idempotent', async () => {
    const dates = ['2026-04-01', '2026-04-02']
    const a = (await apply(alice, personA, '2026-04-01', dates))[0]!.apply_month_plan
    const b = (await apply(alice, personA, '2026-04-01', dates))[0]!.apply_month_plan
    expect(a).toBe(b)
    expect(await mealDates(personA, '2026-04-01')).toEqual(dates)
  })

  it('removes only scheduled meals that are no longer in the list', async () => {
    await apply(alice, personA, '2026-05-01', ['2026-05-04', '2026-05-05', '2026-05-06'])
    await apply(alice, personA, '2026-05-01', ['2026-05-04', '2026-05-06'])
    expect(await mealDates(personA, '2026-05-01')).toEqual(['2026-05-04', '2026-05-06'])
  })

  it('keeps recorded meals and flags the month for review', async () => {
    await apply(alice, personA, '2026-06-01', ['2026-06-01', '2026-06-02', '2026-06-03'])
    await db.asAdmin(() => db.pg.query(`update meals set status = 'picked_up' where person_id = $1 and meal_date = '2026-06-02'`, [personA]))
    await apply(alice, personA, '2026-06-01', ['2026-06-01', '2026-06-03'])
    expect(await mealDates(personA, '2026-06-01')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    const flag = await db.asAdmin(() => db.pg.query<{ needs_review: boolean }>(`select needs_review from monthly_plans where person_id = $1 and month = '2026-06-01'`, [personA]))
    expect(flag.rows[0]!.needs_review).toBe(true)
    // once the list covers the recorded meal again, the flag clears
    await apply(alice, personA, '2026-06-01', ['2026-06-01', '2026-06-02', '2026-06-03'])
    const cleared = await db.asAdmin(() => db.pg.query<{ needs_review: boolean }>(`select needs_review from monthly_plans where person_id = $1 and month = '2026-06-01'`, [personA]))
    expect(cleared.rows[0]!.needs_review).toBe(false)
  })

  it('never removes or flags meals before the window start (an earlier plan period)', async () => {
    await apply(alice, personA, '2026-10-01', ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'])
    await db.asAdmin(() => db.pg.query(`update meals set status = 'picked_up' where person_id = $1 and meal_date = '2026-10-05'`, [personA]))
    // the person returned on the 7th: only the 7th onwards is the current window
    await db.asUser(alice, () => db.pg.query(`select apply_month_plan($1, '2026-10-01', '{2026-10-07}'::date[], 20, true, '2026-10-07')`, [personA]))
    expect(await mealDates(personA, '2026-10-01')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']) // 8th is in the window, not wanted: removed
    const flag = await db.asAdmin(() => db.pg.query<{ needs_review: boolean }>(`select needs_review from monthly_plans where person_id = $1 and month = '2026-10-01'`, [personA]))
    expect(flag.rows[0]!.needs_review).toBe(false)
  })

  it('rejects a weekend date atomically, leaving nothing behind', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`select apply_month_plan($1, '2026-07-01', '{2026-07-01,2026-07-04}'::date[], 20, false)`, [personA])))
    expect(err).toContain('E_INVALID_DATE')
    expect(await mealDates(personA, '2026-07-01')).toEqual([])
  })

  it('rejects dates outside the month and months that are not the first day', async () => {
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`select apply_month_plan($1, '2026-08-01', '{2026-09-01}'::date[], 20, false)`, [personA])))).toContain('E_INVALID_DATE')
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`select apply_month_plan($1, '2026-08-15', '{}'::date[], 20, false)`, [personA])))).toContain('E_INVALID_DATE')
  })

  it('has one plan per person and month (RULE-001)', async () => {
    await apply(alice, personA, '2026-09-01', ['2026-09-01'])
    await apply(alice, personA, '2026-09-01', ['2026-09-01', '2026-09-02'])
    const n = await db.asAdmin(() => db.pg.query<{ n: number }>(`select count(*)::int as n from monthly_plans where person_id = $1 and month = '2026-09-01'`, [personA]))
    expect(n.rows[0]!.n).toBe(1)
  })

  it('refuses to touch another household\'s person (E_NOT_FOUND)', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`select apply_month_plan($1, '2026-03-01', '{2026-03-02}'::date[], 20, false)`, [personB])))
    expect(err).toContain('E_NOT_FOUND')
  })

  it('does not let the app write meals directly', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`delete from meals`)))
    expect(err).toContain('permission denied')
    const err2 = await db.asUser(alice, () => errorOf(db.pg.query(`update meals set status = 'picked_up'`)))
    expect(err2).toContain('permission denied')
  })

  it('shows each household only its own meals', async () => {
    await db.asAdmin(() => db.pg.query(`select 1`)) // reset
    await db.asUser(eve, async () => { await db.pg.query(`select apply_month_plan($1, '2026-03-01', '{2026-03-02}'::date[], 20, false)`, [personB]) })
    const aliceSees = await rpc<{ person_id: string }>(alice, `select distinct person_id from meals`)
    expect(aliceSees.map((r) => r.person_id)).toEqual([personA])
  })
})

describe('automatic "not picked up" for unrecorded past meals (spec FR-015a)', () => {
  it('derives the effective status without changing the stored one', async () => {
    const plan = await newPlan(personA, '2026-01-01')
    await insertMeal(personA, householdA, plan, '2026-01-05')
    await db.asAdmin(() => db.pg.query(`insert into meals (monthly_plan_id, person_id, household_id, meal_date) values ($1,$2,$3,'2099-01-05')`, [plan, personA, householdA]).catch(() => null))
    const rows = await rpc<{ meal_date: string; status: string; effective_status: string; is_automatic: boolean }>(alice,
      `select meal_date::text, status::text, effective_status::text, is_automatic from meals_numbered where meal_date in ('2026-01-05') `)
    expect(rows[0]).toMatchObject({ status: 'scheduled', effective_status: 'not_picked_up', is_automatic: true })
  })
})
