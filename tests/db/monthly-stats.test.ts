import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { computeStats } from '../../src/domain/stats'
import { toPlainDate } from '../../src/domain/plain-date'
import { createDb, type TestDb } from './harness'

let db: TestDb
let alice: string
let eve: string
let householdA: string
let person: string
let plan: string

/** Weekday dates starting at `from`, skipping weekends (no holiday data needed before 2024). */
function weekdays(from: string, count: number): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  while (out.length < count) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

const addMeal = async (date: string, status = 'scheduled', photo = false) => {
  const id = (await db.asAdmin(() => db.pg.query<{ id: string }>(
    `insert into meals (monthly_plan_id, person_id, household_id, meal_date, status) values ($1,$2,$3,$4,$5::meal_status) returning id`,
    [plan, person, householdA, date, status]))).rows[0]!.id
  if (photo) {
    await db.asAdmin(() => db.pg.query(
      `insert into meal_photos (id, meal_id, household_id, storage_path, thumb_path, mime_type, bytes, taken_at)
       values (gen_random_uuid(), $1, $2, 'a', 'b', 'image/webp', 1000, now())`, [id, householdA]))
  }
}

const stats = async (user: string) =>
  db.asUser(user, async () => (await db.pg.query<Record<string, number | boolean>>(`select * from monthly_stats`)).rows)

beforeAll(async () => {
  db = await createDb()
  alice = await db.createUser()
  eve = await db.createUser()
  householdA = (await db.asUser(alice, async () => (await db.pg.query<{ id: string }>(`select create_household('A','Alice') as id`)).rows[0]!.id))
  await db.asAdmin(async () => {
    const h = await db.pg.query<{ id: string }>(`insert into households (name) values ('B') returning id`)
    await db.pg.query(`insert into household_members (household_id, user_id, role, display_name) values ($1,$2,'owner','Eve')`, [h.rows[0]!.id, eve])
  })
  person = (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into people (household_id, first_name, plan_start_date) values ($1,'Ana','2024-01-01') returning id`, [householdA]))).rows[0]!.id
  plan = (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into monthly_plans (person_id, household_id, month, contracted_count) values ($1,$2,'2025-03-01',20) returning id`, [person, householdA]))).rows[0]!.id
})

afterAll(async () => db.close())

describe('monthly_stats', () => {
  it('shows a plan with no meals as zeros', async () => {
    const [row] = await stats(alice)
    expect(row).toMatchObject({ scheduled_total: 0, picked_up: 0, pending: 0, photos: 0, is_consistent: true })
  })

  it('counts every status, the automatic ones, the photos, and adds up to the scheduled meals', async () => {
    const past = weekdays('2025-03-05', 20) // after Carnival 2025 (Mar 3-4), which the database rightly rejects
    // 14 picked up (2 with photos), 2 cancelled, 1 not picked up, 1 permission (with photo),
    // 1 forgotten past meal (scheduled in the past) = 19 past meals
    for (const [i, date] of past.slice(0, 14).entries()) await addMeal(date, 'picked_up', i < 2)
    await addMeal(past[14]!, 'cancelled')
    await addMeal(past[15]!, 'cancelled')
    await addMeal(past[16]!, 'not_picked_up')
    await addMeal(past[17]!, 'permission', true)
    await addMeal(past[18]!, 'scheduled') // forgotten: automatic "not picked up"
    // 2 pending in the future
    const future = weekdays('2099-01-05', 2)
    for (const date of future) await addMeal(date)

    const [row] = await stats(alice)
    expect(row).toMatchObject({
      scheduled_total: 21,
      picked_up: 14,
      cancelled: 2,
      not_picked_up: 2, // 1 recorded + 1 automatic
      automatic_not_picked_up: 1,
      permission: 1,
      pending: 2, // only the future ones
      photos: 3,
      is_consistent: true,
    })
    const sum = (row!.picked_up as number) + (row!.cancelled as number) + (row!.not_picked_up as number) + (row!.permission as number) + (row!.pending as number)
    expect(sum).toBe(row!.scheduled_total)
  })

  it('exposes the contracted count and the review flags', async () => {
    const [row] = await stats(alice)
    expect(row).toMatchObject({ contracted_count: 20, is_partial: false, needs_review: false })
  })

  it('never shows one household\'s numbers to another', async () => {
    expect(await stats(eve)).toHaveLength(0)
  })

  it('matches the TypeScript stats module exactly (one rule, two implementations)', async () => {
    const meals = (await db.asAdmin(() => db.pg.query<{ meal_date: string; status: string; id: string }>(
      `select meal_date::text, status::text, id from meals where monthly_plan_id = $1`, [plan]))).rows
    const photoIds = new Set((await db.asAdmin(() => db.pg.query<{ meal_id: string }>(`select meal_id from meal_photos`))).rows.map((r) => r.meal_id))
    const today = (await db.pg.query<{ d: string }>(`select bolivia_today()::text as d`)).rows[0]!.d
    const ts = computeStats({
      meals: meals.map((m) => ({ date: toPlainDate(m.meal_date), status: m.status as never, hasPhoto: photoIds.has(m.id) })),
      contracted: 20, isPartial: false, today: toPlainDate(today),
    })
    const [row] = await stats(alice)
    expect({
      scheduled_total: ts.scheduledTotal, picked_up: ts.pickedUp, cancelled: ts.cancelled, not_picked_up: ts.notPickedUp,
      automatic_not_picked_up: ts.automaticNotPickedUp, permission: ts.permission, pending: ts.pending, photos: ts.photos,
    }).toMatchObject({
      scheduled_total: row!.scheduled_total, picked_up: row!.picked_up, cancelled: row!.cancelled, not_picked_up: row!.not_picked_up,
      automatic_not_picked_up: row!.automatic_not_picked_up, permission: row!.permission, pending: row!.pending, photos: row!.photos,
    })
  })
})
