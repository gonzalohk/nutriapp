import { addMonths, monthStart, type PlainDate } from '@/domain/plain-date'
import { endDateOnDeactivate, startDateOnReactivate } from '@/domain/person-lifecycle'
import { toPlainDate } from '@/domain/plain-date'
import { ensureMonthPlan } from './mutations'
import { supabase } from './supabase'
import type { Person } from './types'

export interface NewPerson {
  firstName: string
  lastName: string
  planStart: PlainDate
  mealsPerMonth: number
}

/** Regenerate the current and next month of a person so the meals match their (new) dates. */
async function reconcileCurrentMonths(person: Person, today: PlainDate): Promise<void> {
  const current = monthStart(today)
  await ensureMonthPlan(person, current)
  await ensureMonthPlan(person, addMonths(current, 1))
}

export async function createPerson(input: NewPerson, today: PlainDate): Promise<Person> {
  const { data, error } = await supabase.rpc('create_person', {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_plan_start: input.planStart,
    p_meals_per_month: input.mealsPerMonth,
  })
  if (error) throw error
  await reconcileCurrentMonths(data, today)
  return data
}

export async function renamePerson(person: Person, firstName: string, lastName: string): Promise<void> {
  const { error } = await supabase
    .from('people')
    .update({ first_name: firstName, last_name: lastName.trim() === '' ? null : lastName })
    .eq('id', person.id)
  if (error) throw error
}

/** Hide a person from daily use and stop their plan yesterday. Their history is kept. */
export async function deactivatePerson(person: Person, today: PlainDate): Promise<void> {
  const end = endDateOnDeactivate(
    toPlainDate(person.plan_start_date),
    person.plan_end_date ? toPlainDate(person.plan_end_date) : null,
    today,
  )
  const { data, error } = await supabase
    .from('people')
    .update({ active: false, plan_end_date: end })
    .eq('id', person.id)
    .select('*')
    .single()
  if (error) throw error
  await reconcileCurrentMonths(data, today)
}

/** Bring a person back. If they had left, a new period starts today and the gap makes no meals. */
export async function reactivatePerson(person: Person, today: PlainDate): Promise<void> {
  const start = startDateOnReactivate(
    toPlainDate(person.plan_start_date),
    person.plan_end_date ? toPlainDate(person.plan_end_date) : null,
    today,
  )
  const { data, error } = await supabase
    .from('people')
    .update({ active: true, plan_end_date: null, plan_start_date: start })
    .eq('id', person.id)
    .select('*')
    .single()
  if (error) throw error
  await reconcileCurrentMonths(data, today)
}
