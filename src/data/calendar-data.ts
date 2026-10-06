import { HolidayDataMissing, planMonth, type MonthPlan, type PlanMonthInput } from '@/domain/calendar'
import {
  monthEnd,
  toPlainDate,
  type IsoWeekday,
  type PlainDate,
} from '@/domain/plain-date'
import type { MonthMeal } from '@/domain/month-view'
import { AppError } from './errors'
import { fetchPhotoRefs } from './photo-refs'
import { supabase } from './supabase'
import type { MonthlyPlan, Person, PlanTerm } from './types'

export { HolidayDataMissing }

/** Years for which the database has holiday data. Planning outside them is refused. */
export async function fetchHolidayCoverage(countryCode = 'BO') {
  const { data, error } = await supabase
    .from('official_holiday_years')
    .select('first_year, last_year')
    .eq('country_code', countryCode)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new AppError('E_NO_HOLIDAY_DATA')
  return { firstYear: data.first_year, lastYear: data.last_year }
}

/** Effective holidays (official minus suppressed plus custom) in a date range, by date. */
export async function fetchHolidays(from: PlainDate, to: PlainDate): Promise<Map<PlainDate, string>> {
  const { data, error } = await supabase
    .from('effective_holidays')
    .select('holiday_date, name')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
  if (error) throw error
  return new Map(data.map((h) => [toPlainDate(h.holiday_date!), h.name ?? '']))
}

export async function fetchExceptionalDates(from: PlainDate, to: PlainDate): Promise<Set<PlainDate>> {
  const { data, error } = await supabase
    .from('exceptional_delivery_dates')
    .select('delivery_date')
    .gte('delivery_date', from)
    .lte('delivery_date', to)
  if (error) throw error
  return new Set(data.map((r) => toPlainDate(r.delivery_date)))
}

/** The plan terms in force for a month: the latest term that starts on or before it. */
export async function fetchPlanTerm(personId: string, month: PlainDate): Promise<PlanTerm | null> {
  const { data, error } = await supabase
    .from('plan_terms')
    .select('*')
    .eq('person_id', personId)
    .lte('effective_from', month)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

function toWeekdays(values: number[]): IsoWeekday[] {
  return values.filter((v): v is IsoWeekday => Number.isInteger(v) && v >= 1 && v <= 7)
}

export interface MonthInputs {
  input: PlanMonthInput
  holidays: Map<PlainDate, string>
  term: PlanTerm
}

/** Gather everything the calendar module needs for one person and month. */
export async function loadMonthInputs(person: Person, month: PlainDate): Promise<MonthInputs | null> {
  const term = await fetchPlanTerm(person.id, month)
  if (!term) {
    // No terms yet means the plan has not started by this month.
    if (monthEnd(month) < person.plan_start_date) return null
    throw new AppError('E_NO_PLAN_TERMS')
  }
  const end = monthEnd(month)
  const [coverage, holidays, exceptionalDates] = await Promise.all([
    fetchHolidayCoverage(),
    fetchHolidays(month, end),
    fetchExceptionalDates(month, end),
  ])
  return {
    term,
    holidays,
    input: {
      month,
      mealsPerMonth: term.meals_per_month,
      deliveryWeekdays: toWeekdays(term.delivery_weekdays),
      planStart: toPlainDate(person.plan_start_date),
      planEnd: person.plan_end_date ? toPlainDate(person.plan_end_date) : null,
      holidays: new Set(holidays.keys()),
      exceptionalDates,
      holidayCoverage: coverage,
    },
  }
}

export async function computeMonthPlan(person: Person, month: PlainDate): Promise<MonthPlan | null> {
  const inputs = await loadMonthInputs(person, month)
  return inputs ? planMonth(inputs.input) : null
}

export interface MonthView {
  monthlyPlan: MonthlyPlan | null
  meals: MonthMeal[]
  holidays: Map<PlainDate, string>
  /** What the calendar module computes for this month (extra days, shortfall). */
  plan: MonthPlan | null
}

/** Everything the Month screen shows for one person and month. */
export async function loadMonthView(person: Person, month: PlainDate): Promise<MonthView> {
  const end = monthEnd(month)
  const [planRes, mealsRes, inputs] = await Promise.all([
    supabase.from('monthly_plans').select('*').eq('person_id', person.id).eq('month', month).maybeSingle(),
    supabase
      .from('meals_numbered')
      .select('id, meal_date, meal_no, status, effective_status, is_automatic')
      .eq('person_id', person.id)
      .gte('meal_date', month)
      .lte('meal_date', end)
      .order('meal_date'),
    loadMonthInputs(person, month),
  ])
  if (planRes.error) throw planRes.error
  if (mealsRes.error) throw mealsRes.error
  const photos = await fetchPhotoRefs(mealsRes.data.map((m) => m.id!))
  return {
    monthlyPlan: planRes.data,
    meals: mealsRes.data.map((m) => ({
      id: m.id!,
      date: toPlainDate(m.meal_date!),
      mealNo: m.meal_no!,
      status: m.status!,
      effectiveStatus: m.effective_status!,
      isAutomatic: m.is_automatic!,
      hasPhoto: photos.has(m.id!),
    })),
    holidays: inputs?.holidays ?? new Map(),
    plan: inputs ? planMonth(inputs.input) : null,
  }
}
