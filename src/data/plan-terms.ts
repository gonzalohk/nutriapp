import type { IsoWeekday, PlainDate } from '@/domain/plain-date'
import { fetchPlanTerm } from './calendar-data'
import { supabase } from './supabase'
import type { PlanTerm } from './types'

export { fetchPlanTerm }

export interface PlanTermInput {
  personId: string
  /** First day of the month the new terms start in. */
  effectiveFrom: PlainDate
  mealsPerMonth: number
  weekdays: readonly IsoWeekday[]
  pickupTime: string | null
}

/**
 * Save plan terms from a month on. Terms are added, never rewritten, so earlier months keep the
 * terms they were generated with; saving again for the same month replaces that month's terms.
 */
export async function savePlanTerm(input: PlanTermInput): Promise<PlanTerm> {
  const { data, error } = await supabase
    .from('plan_terms')
    .upsert(
      {
        person_id: input.personId,
        effective_from: input.effectiveFrom,
        meals_per_month: input.mealsPerMonth,
        delivery_weekdays: [...input.weekdays],
        pickup_time: input.pickupTime || null,
      },
      { onConflict: 'person_id,effective_from' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}
