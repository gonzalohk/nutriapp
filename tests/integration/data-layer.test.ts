import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest'
import pg from 'pg'
import { toPlainDate } from '@/domain/plain-date'

// The app's own data layer, unchanged, talking to a real PostgREST over a real Postgres.
const d = toPlainDate
type Mutations = typeof import('@/data/mutations')
type Calendar = typeof import('@/data/calendar-data')
type Today = typeof import('@/data/today')
type Queries = typeof import('@/data/queries')
type Supa = typeof import('@/data/supabase')

let admin: pg.Client
let mutations: Mutations
let calendar: Calendar
let today: Today
let queries: Queries
let supabase: Supa['supabase']
let person: import('@/data/types').Person
let userId: string

const adminQuery = async <T extends object>(sql: string, params: unknown[] = []) => (await admin.query<T>(sql, params)).rows

beforeAll(async () => {
  admin = new pg.Client({ host: '127.0.0.1', port: inject('stackPgPort'), user: 'postgres', password: 'postgres', database: 'app' })
  await admin.connect()
  userId = inject('stackUserId')
  ;({ supabase } = await import('@/data/supabase'))
  mutations = await import('@/data/mutations')
  calendar = await import('@/data/calendar-data')
  today = await import('@/data/today')
  queries = await import('@/data/queries')

  const created = await supabase.rpc('create_household', { p_name: 'Casa integración', p_display_name: 'Integración' })
  expect(created.error).toBeNull()
  const household = created.data!
  const inserted = await supabase
    .from('people')
    .insert({ household_id: household, first_name: 'Ana', plan_start_date: '2026-01-01' })
    .select('*')
    .single()
  expect(inserted.error).toBeNull()
  person = inserted.data!
  const term = await supabase.from('plan_terms').insert({ person_id: person.id, effective_from: '2026-01-01' })
  expect(term.error).toBeNull()
})

afterAll(async () => admin.end())

describe('the data layer against PostgREST', () => {
  it('reads the holiday coverage and the effective holidays (a view)', async () => {
    const coverage = await calendar.fetchHolidayCoverage()
    expect(coverage).toEqual({ firstYear: 2024, lastYear: 2045 })
    const holidays = await calendar.fetchHolidays(d('2026-02-01'), d('2026-02-28'))
    expect([...holidays.keys()].sort()).toEqual(['2026-02-16', '2026-02-17'])
  })

  it('generates October 2026 as 20 meals from the 1st to the 28th', async () => {
    const planId = await mutations.ensureMonthPlan(person, d('2026-10-01'))
    expect(planId).toBeTruthy()
    const view = await calendar.loadMonthView(person, d('2026-10-01'))
    expect(view.meals).toHaveLength(20)
    expect(view.meals[0]).toMatchObject({ date: '2026-10-01', mealNo: 1 })
    expect(view.meals.at(-1)).toMatchObject({ date: '2026-10-28', mealNo: 20 })
    expect(view.plan?.extra).toEqual(['2026-10-29', '2026-10-30'])
    expect(view.monthlyPlan).toMatchObject({ contracted_count: 20, is_partial: false, needs_review: false })
  })

  it('is idempotent: running it again keeps the same plan and meals', async () => {
    const a = await mutations.ensureMonthPlan(person, d('2026-10-01'))
    const b = await mutations.ensureMonthPlan(person, d('2026-10-01'))
    expect(a).toBe(b)
    const rows = await adminQuery<{ n: string }>(`select count(*) as n from meals where person_id = $1`, [person.id])
    expect(Number(rows[0]!.n)).toBe(20)
  })

  it('February 2026 has 18 delivery days: only valid days are created and the shortfall is 2', async () => {
    await mutations.ensureMonthPlan(person, d('2026-02-01'))
    const view = await calendar.loadMonthView(person, d('2026-02-01'))
    expect(view.meals).toHaveLength(18)
    expect(view.plan?.shortfall).toBe(2)
    expect(view.meals.map((m) => m.date)).not.toContain('2026-02-16')
  })

  it('an exceptional Saturday becomes a meal after regenerating the month', async () => {
    await mutations.addExceptionalDelivery(d('2026-02-07'), 'Entrega extra')
    await mutations.ensureMonthPlan(person, d('2026-02-01'))
    const view = await calendar.loadMonthView(person, d('2026-02-01'))
    expect(view.meals.map((m) => m.date)).toContain('2026-02-07')
    expect(view.meals).toHaveLength(19)
    await mutations.removeExceptionalDelivery(d('2026-02-07'))
    await mutations.ensureMonthPlan(person, d('2026-02-01'))
    expect((await calendar.loadMonthView(person, d('2026-02-01'))).meals).toHaveLength(18)
  })

  it('refuses a weekend date with the stable error code E_INVALID_DATE', async () => {
    const { errorCode } = await import('@/data/errors')
    const res = await supabase.rpc('apply_month_plan', {
      p_person: person.id, p_month: '2026-11-01', p_dates: ['2026-11-07'], p_contracted: 20, p_is_partial: false,
    })
    expect(res.error).not.toBeNull()
    expect(errorCode(res.error)).toBe('E_INVALID_DATE')
  })

  it('loads today with the person, their meal and the reason when there is none', async () => {
    const people = (await supabase.from('people').select('*')).data!
    const thursday = await today.loadToday(people, d('2026-10-01'))
    expect(thursday).toHaveLength(1)
    expect(thursday[0]!.meal).toMatchObject({ mealDate: '2026-10-01', mealNo: 1, status: 'scheduled' })
    const saturday = await today.loadToday(people, d('2026-10-03'))
    expect(saturday[0]).toMatchObject({ meal: null, reason: 'weekend' })
    const carnival = await today.loadToday(people, d('2026-02-16'))
    expect(carnival[0]).toMatchObject({ meal: null, reason: 'holiday', holidayName: 'Lunes de Carnaval' })
  })

  it('records an outcome, keeps the change log and attributes it to the user', async () => {
    const people = (await supabase.from('people').select('*')).data!
    const entry = (await today.loadToday(people, d('2026-10-01')))[0]!
    await mutations.setMealStatus({ mealId: entry.meal!.id, status: 'picked_up' })
    await mutations.setMealStatus({ mealId: entry.meal!.id, status: 'picked_up' }) // same again: no-op
    await mutations.setMealStatus({ mealId: entry.meal!.id, status: 'not_picked_up', note: 'Olvidé' })
    await mutations.setMealStatus({ mealId: entry.meal!.id, status: 'picked_up' })
    const changes = await today.loadStatusChanges(entry.meal!.id)
    expect(changes.map((c) => `${c.fromStatus}>${c.toStatus}`)).toEqual([
      'scheduled>picked_up', 'picked_up>not_picked_up', 'not_picked_up>picked_up',
    ])
    expect(changes[0]!.changedBy).toBe(userId)
    expect(changes[0]!.changedByName).toBe('Integración')
    const reloaded = await today.loadMeal(entry.meal!.id)
    expect(reloaded?.meal).toMatchObject({ status: 'picked_up', note: 'Olvidé' })
    expect(reloaded?.person.first_name).toBe('Ana')
  })

  it('shows a forgotten past meal as an automatic "not picked up" in views and totals', async () => {
    const view = await calendar.loadMonthView(person, d('2026-02-01'))
    expect(view.meals.every((m) => m.effectiveStatus === 'not_picked_up' && m.isAutomatic)).toBe(true)
    const totals = await queries.loadMonthTotals(d('2026-02-01'))
    expect(totals.get(person.id)).toEqual({ pending: 0, contracted: 20 })
  })

  it('reads a meal photo reference with the photo flag in the month view', async () => {
    const meal = (await calendar.loadMonthView(person, d('2026-10-01'))).meals[1]!
    const household = (await adminQuery<{ household_id: string }>(`select household_id from meals where id = $1`, [meal.id]))[0]!.household_id
    await admin.query(
      `insert into meal_photos (id, meal_id, household_id, storage_path, thumb_path, mime_type, bytes, taken_at)
       values (gen_random_uuid(), $1, $2, 'a/b.webp', 'a/b_thumb.webp', 'image/webp', 1000, now())`,
      [meal.id, household],
    )
    const view = await calendar.loadMonthView(person, d('2026-10-01'))
    expect(view.meals.find((m) => m.id === meal.id)?.hasPhoto).toBe(true)
    const refs = await (await import('@/data/photo-refs')).fetchPhotoRefs([meal.id])
    expect(refs.get(meal.id)).toMatchObject({ thumbPath: 'a/b_thumb.webp', storagePath: 'a/b.webp' })
  })

  it('adding a holiday returns the affected months and a regeneration drops the scheduled meal', async () => {
    const res = await supabase.rpc('add_holiday', { p_date: '2026-10-14', p_name: 'Feriado local' })
    expect(res.error).toBeNull()
    expect(res.data).toEqual([{ person_id: person.id, month: '2026-10-01' }])
    await mutations.ensureMonthPlan(person, d('2026-10-01'))
    const view = await calendar.loadMonthView(person, d('2026-10-01'))
    expect(view.meals.map((m) => m.date)).not.toContain('2026-10-14')
    expect(view.holidays.get(d('2026-10-14'))).toBe('Feriado local')
    // 21 valid days remain; the 20 contracted meals now run to the 29th
    expect(view.meals).toHaveLength(20)
    expect(view.meals.at(-1)!.date).toBe('2026-10-29')
  })
})

describe('history queries against PostgREST', () => {
  it('lists each month of a person with its counters', async () => {
    const history = await (await import('@/data/history')).loadHistory(person.id)
    const oct = history.find((m) => m.month === '2026-10-01')!
    expect(oct).toMatchObject({ contracted: 20, isPartial: false, isConsistent: true })
    expect(oct.scheduled).toBe(oct.pickedUp + oct.cancelled + oct.notPickedUp + oct.permission + oct.pending)
    expect(history.map((m) => m.month)).toEqual([...history.map((m) => m.month)].sort())
  })

  it('loads one month of meals with their photo references', async () => {
    const meals = await (await import('@/data/history')).loadMonthMeals(person.id, d('2026-10-01'), d('2026-10-31'))
    expect(meals.length).toBeGreaterThan(0)
    expect(meals.some((m) => m.photo?.thumbPath === 'a/b_thumb.webp')).toBe(true)
  })
})

describe('settings flows against PostgREST', () => {
  const TODAY = d('2026-10-04')

  it('previews removing a holiday: the first-20 rule moves the last meal to the freed day', async () => {
    const { previewDateChange } = await import('@/data/change-preview')
    const people = (await supabase.from('people').select('*')).data!
    const rows = await previewDateChange(people, d('2026-10-14'), 'holiday-remove', TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.summary).toMatchObject({ remove: ['2026-10-29'], add: ['2026-10-14'], keptFlagged: [] })
  })

  it('previews the same change as "kept and flagged" once that meal has been recorded', async () => {
    const { previewDateChange } = await import('@/data/change-preview')
    const people = (await supabase.from('people').select('*')).data!
    const last = (await calendar.loadMonthView(person, d('2026-10-01'))).meals.find((m) => m.date === '2026-10-29')!
    await mutations.setMealStatus({ mealId: last.id, status: 'picked_up' })
    const rows = await previewDateChange(people, d('2026-10-14'), 'holiday-remove', TODAY)
    expect(rows[0]!.summary).toMatchObject({ remove: [], keptFlagged: ['2026-10-29'] })
  })

  it('previews nothing for a date that changes no meal', async () => {
    const { previewDateChange } = await import('@/data/change-preview')
    const people = (await supabase.from('people').select('*')).data!
    expect(await previewDateChange(people, d('2026-10-31'), 'holiday-add', TODAY)).toEqual([])
  })

  it('saves plan terms from a month on and leaves earlier months untouched', async () => {
    const { savePlanTerm, fetchPlanTerm } = await import('@/data/plan-terms')
    await savePlanTerm({ personId: person.id, effectiveFrom: d('2026-11-01'), mealsPerMonth: 25, weekdays: [1, 2, 3, 4, 5], pickupTime: '12:30' })
    expect((await fetchPlanTerm(person.id, d('2026-11-01')))?.meals_per_month).toBe(25)
    expect((await fetchPlanTerm(person.id, d('2026-10-01')))?.meals_per_month).toBe(20)
    expect((await fetchPlanTerm(person.id, d('2026-11-01')))?.pickup_time?.slice(0, 5)).toBe('12:30')
    // saving again for the same month replaces that month's terms instead of failing
    await savePlanTerm({ personId: person.id, effectiveFrom: d('2026-11-01'), mealsPerMonth: 22, weekdays: [1, 2, 3, 4, 5], pickupTime: null })
    expect((await fetchPlanTerm(person.id, d('2026-11-01')))?.meals_per_month).toBe(22)

    await mutations.ensureMonthPlan(person, d('2026-11-01'))
    const nov = await calendar.loadMonthView(person, d('2026-11-01'))
    expect(nov.plan?.contracted).toBe(22)
    expect(nov.meals).toHaveLength(20) // November 2026 has 20 valid days (2 Nov is a holiday)
    expect(nov.plan?.shortfall).toBe(2)
    expect((await calendar.loadMonthView(person, d('2026-10-01'))).meals).toHaveLength(20)
  })

  it('creates a person with their first terms and an invitation code through the data layer', async () => {
    const actions = await import('@/data/people-actions')
    const beto = await actions.createPerson({ firstName: 'Beto', lastName: '', planStart: d('2026-10-15'), mealsPerMonth: 20 }, TODAY)
    expect(beto.last_name).toBeNull()
    const view = await calendar.loadMonthView(beto, d('2026-10-01'))
    expect(view.plan?.isPartial).toBe(true)
    expect(view.meals[0]!.date).toBe('2026-10-15')

    const code = await (await import('@/data/household')).createInvite()
    expect(code).toMatch(/^[0-9a-f]{20}$/)
    const members = await (await import('@/data/household')).fetchMembers()
    expect(members).toEqual([{ userId, displayName: 'Integración', role: 'owner' }])
  })

  it('deactivating removes future scheduled meals; reactivating starts a new period without a gap', async () => {
    const actions = await import('@/data/people-actions')
    const people = (await supabase.from('people').select('*')).data!
    const beto = people.find((p) => p.first_name === 'Beto')!
    await actions.deactivatePerson(beto, d('2026-10-20'))
    const after = (await supabase.from('people').select('*').eq('id', beto.id).single()).data!
    expect(after).toMatchObject({ active: false, plan_end_date: '2026-10-19' })
    const meals = await calendar.loadMonthView(after, d('2026-10-01'))
    expect(meals.meals.at(-1)!.date).toBe('2026-10-19') // nothing after the end date remains
    expect((await calendar.loadMonthView(after, d('2026-11-01'))).meals).toHaveLength(0)

    await actions.reactivatePerson(after, d('2026-10-26'))
    const back = (await supabase.from('people').select('*').eq('id', beto.id).single()).data!
    expect(back).toMatchObject({ active: true, plan_end_date: null, plan_start_date: '2026-10-26' })
    const resumed = await calendar.loadMonthView(back, d('2026-10-01'))
    const dates = resumed.meals.map((m) => m.date)
    expect(dates).not.toContain('2026-10-22') // the gap between leaving and returning makes no meals
    expect(dates).toContain('2026-10-26')
    expect(dates).toContain('2026-10-15') // the earlier period is left exactly as it was
    expect(dates).toContain('2026-10-19')
  })
})

describe('export against PostgREST', () => {
  it('exports every meal even past the 1000-row page limit, with status changes and photos', async () => {
    const household = (await adminQuery<{ id: string }>(`select id from households limit 1`))[0]!.id
    const planId = (await adminQuery<{ id: string }>(
      `insert into monthly_plans (person_id, household_id, month, contracted_count) values ($1,$2,'2024-02-01',20)
       on conflict (person_id, month) do update set contracted_count = 20 returning id`, [person.id, household]))[0]!.id
    // 1,300 weekday meals from 2024-03-01 on (after the Carnival holidays of Feb 2024; holidays in the range are skipped)
    await admin.query(
      `insert into meals (monthly_plan_id, person_id, household_id, meal_date)
       select $1, $2, $3, d::date from generate_series('2024-03-01'::date, '2029-12-31'::date, interval '1 day') d
       where extract(isodow from d) < 6
         and not exists (select 1 from effective_holidays e where e.household_id = $3 and e.holiday_date = d::date)
       limit 1300 on conflict do nothing`, [planId, person.id, household])
    const total = Number((await adminQuery<{ n: string }>(`select count(*) as n from meals`))[0]!.n)
    expect(total).toBeGreaterThan(1000)

    const { loadExportData } = await import('@/data/export-data')
    const data = await loadExportData()
    expect(data.meals).toHaveLength(total)
    expect(new Set(data.meals.map((m) => m.id)).size).toBe(total) // no duplicates across pages
    expect(data.changes.length).toBeGreaterThan(0)
    expect(data.changes.every((c) => c.personName !== '')).toBe(true)
    expect(data.photos.some((p) => p.storagePath === 'a/b.webp')).toBe(true)
    const { mealsCsv } = await import('@/features/export/csv')
    expect(mealsCsv(data.meals).trim().split('\r\n')).toHaveLength(total + 1)
  })
})
