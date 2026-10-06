import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, errorOf, type TestDb } from './harness'

let db: TestDb
let alice: string
let eve: string
let householdA: string
let householdB: string
let meal: string
let mealB: string
let status: () => Promise<string>

const call = (user: string, sql: string, params: unknown[] = []) =>
  db.asUser(user, async () => (await db.pg.query<Record<string, unknown>>(sql, params)).rows)

const PHOTO = (id: string, path?: string) => [
  meal, id, path ?? `${householdA}/p/2026-01/${meal}/${id}.webp`, `${householdA}/p/2026-01/${meal}/${id}_thumb.webp`,
  'image/webp', 300_000, 1600, 1200, '2026-01-05T12:00:00Z',
]
const replace = (user: string, args: unknown[]) =>
  call(user, `select replace_meal_photo($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz) as r`, args)

beforeAll(async () => {
  db = await createDb()
  alice = await db.createUser()
  eve = await db.createUser()
  householdA = (await call(alice, `select create_household('A','Alice') as id`))[0]!.id as string
  householdB = await db.asAdmin(async () => {
    const h = await db.pg.query<{ id: string }>(`insert into households (name) values ('B') returning id`)
    await db.pg.query(`insert into household_members (household_id, user_id, role, display_name) values ($1,$2,'owner','Eve')`, [h.rows[0]!.id, eve])
    return h.rows[0]!.id
  })
  const setup = async (h: string, name: string) => {
    const p = (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into people (household_id, first_name, plan_start_date) values ($1,$2,'2024-01-01') returning id`, [h, name]))).rows[0]!.id
    const pl = (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into monthly_plans (person_id, household_id, month, contracted_count) values ($1,$2,'2026-01-01',20) returning id`, [p, h]))).rows[0]!.id
    return (await db.asAdmin(() => db.pg.query<{ id: string }>(`insert into meals (monthly_plan_id, person_id, household_id, meal_date) values ($1,$2,$3,'2026-01-05') returning id`, [pl, p, h]))).rows[0]!.id
  }
  meal = await setup(householdA, 'Ana')
  mealB = await setup(householdB, 'Zoe')
  await call(alice, `select * from set_meal_status($1,'picked_up',null,null,null)`, [meal])
  status = async () => (await db.asAdmin(() => db.pg.query<{ status: string }>(`select status::text from meals where id = $1`, [meal]))).rows[0]!.status
})

afterAll(async () => db.close())

describe('meal photo rows', () => {
  const id1 = '11111111-1111-1111-1111-111111111111'
  const id2 = '22222222-2222-2222-2222-222222222222'

  it('attaches one photo to a meal', async () => {
    const r = await replace(alice, PHOTO(id1))
    expect(r[0]!.r).toEqual({ previous_storage_path: null, previous_thumb_path: null })
    const rows = await call(alice, `select id, mime_type, bytes from meal_photos`)
    expect(rows).toHaveLength(1)
  })

  it('replaces the photo and returns the old paths so the client can delete them', async () => {
    const r = await replace(alice, PHOTO(id2))
    expect((r[0]!.r as { previous_storage_path: string }).previous_storage_path).toContain(id1)
    const rows = await call(alice, `select id from meal_photos`)
    expect(rows.map((x) => x.id)).toEqual([id2]) // still exactly one photo for the meal
  })

  it('enforces one photo per meal at the table level', async () => {
    const err = await errorOf(db.asAdmin(() => db.pg.query(
      `insert into meal_photos (id, meal_id, household_id, storage_path, thumb_path, mime_type, bytes, taken_at, created_by)
       values (gen_random_uuid(), $1, $2, 'x', 'y', 'image/webp', 1000, now(), $3)`, [meal, householdA, alice])))
    expect(err).toContain('unique')
  })

  it('rejects a mime type other than webp or jpeg', async () => {
    const args = PHOTO(id1); args[4] = 'image/gif'
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`select replace_meal_photo($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`, args)))).toContain('check')
  })

  it('rejects a file over 2 MB', async () => {
    const args = PHOTO(id1); args[5] = 2_097_153
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`select replace_meal_photo($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`, args)))).toContain('check')
  })

  it('rejects paths that point outside the household\'s folder (E_INVALID_PATH)', async () => {
    const args = PHOTO(id1, `${householdB}/p/2026-01/${meal}/${id1}.webp`)
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`select replace_meal_photo($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`, args)))).toContain('E_INVALID_PATH')
  })

  it('refuses another household\'s meal (E_NOT_FOUND)', async () => {
    const args = PHOTO(id1); args[0] = mealB
    expect(await db.asUser(alice, () => errorOf(db.pg.query(`select replace_meal_photo($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`, args)))).toContain('E_NOT_FOUND')
  })

  it('hides photo rows from other households', async () => {
    expect(await call(eve, `select * from meal_photos`)).toHaveLength(0)
  })

  it('deleting a photo returns its paths and leaves the meal status unchanged (spec FR-026)', async () => {
    const before = await status()
    const r = await call(alice, `select delete_meal_photo($1) as r`, [id2])
    expect((r[0]!.r as { storage_path: string }).storage_path).toContain(id2)
    expect(await call(alice, `select * from meal_photos`)).toHaveLength(0)
    expect(await status()).toBe(before)
  })

  it('does not let the app write photo rows directly', async () => {
    const err = await db.asUser(alice, () => errorOf(db.pg.query(`delete from meal_photos`)))
    expect(err).toContain('permission denied')
  })
})

describe('private storage bucket', () => {
  it('is private, limited to 2 MB and to webp/jpeg', async () => {
    const r = await db.asAdmin(() => db.pg.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit::text, allowed_mime_types from storage.buckets where id = 'meal-photos'`))
    expect(r.rows[0]).toEqual({ public: false, file_size_limit: '2097152', allowed_mime_types: ['image/webp', 'image/jpeg'] })
  })

  const putObject = (user: string, path: string) =>
    errorOf(db.asUser(user, () => db.pg.query(`insert into storage.objects (bucket_id, name, owner) values ('meal-photos', $1, auth.uid())`, [path])))

  it('lets a member upload and read inside their household folder', async () => {
    expect(await putObject(alice, `${householdA}/x/file.webp`)).toBeNull()
    expect(await call(alice, `select name from storage.objects`)).toHaveLength(1)
  })

  it('denies uploading into another household\'s folder', async () => {
    expect(await putObject(alice, `${householdB}/x/file.webp`)).toContain('row-level security')
  })

  it('denies reading another household\'s objects and malformed folders', async () => {
    expect(await call(eve, `select name from storage.objects`)).toHaveLength(0)
    expect(await putObject(alice, `not-a-uuid/x/file.webp`)).toContain('row-level security')
  })

  it('denies anonymous access', async () => {
    await db.pg.exec(`reset role; set role anon;`)
    const err = await errorOf(db.pg.query(`select * from storage.objects`))
    await db.pg.exec(`reset role;`)
    expect(err).toContain('permission denied')
  })

  it('lets a member delete their own household\'s objects but not rename them', async () => {
    await db.asUser(alice, () => errorOf(db.pg.query(`update storage.objects set name = name || 'x'`)))
    const names = (await call(alice, `select name from storage.objects`)).map((r) => r.name as string)
    expect(names).toHaveLength(1)
    expect(names[0]!.endsWith('x')).toBe(false) // no update policy: the rename changed nothing
    await db.asUser(alice, () => db.pg.query(`delete from storage.objects where name like $1`, [`${householdA}/%`]))
    expect(await call(alice, `select name from storage.objects`)).toHaveLength(0)
  })
})
