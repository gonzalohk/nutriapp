import type { Tables, Views } from './database.types'

export type Person = Tables<'people'>
export type PlanTerm = Tables<'plan_terms'>
export type MonthlyPlan = Tables<'monthly_plans'>
export type MealRow = Views<'meals_numbered'>
