import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlainDate } from '@/domain/plain-date'
import { monthKey } from '@/domain/plain-date'
import { loadMonthView } from './calendar-data'
import { supabase } from './supabase'
import type { Person } from './types'
import { getSignedUrl, getSignedUrls } from './photos'
import { loadMeal, loadStatusChanges, loadToday, type TodayEntry } from './today'
import type { SetMealStatusInput } from './mutations'
import { recordStatus } from './sync'
import { loadHistory, loadMonthMeals } from './history'
import { monthEnd } from '@/domain/plain-date'
import { isRecordableStatus } from '@/domain/meal-status'

export const keys = {
  people: ['people'] as const,
  month: (personId: string, month: PlainDate) => ['month', personId, monthKey(month)] as const,
}

export function usePeople() {
  return useQuery({
    queryKey: keys.people,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.from('people').select('*').order('first_name')
      if (error) throw error
      return data
    },
  })
}

export function useMonthView(person: Person | undefined, month: PlainDate, enabled = true) {
  return useQuery({
    queryKey: person ? keys.month(person.id, month) : ['month', 'none'],
    enabled: Boolean(person) && enabled,
    queryFn: () => loadMonthView(person!, month),
  })
}

export const todayKey = (date: PlainDate) => ['today', date] as const

export function useToday(people: readonly Person[] | undefined, today: PlainDate, enabled = true) {
  return useQuery({
    queryKey: todayKey(today),
    enabled: enabled && Boolean(people),
    queryFn: () => loadToday(people!, today),
  })
}

export function useMeal(mealId: string) {
  return useQuery({ queryKey: ['meal', mealId], queryFn: () => loadMeal(mealId) })
}

export function useStatusChanges(mealId: string) {
  return useQuery({
    queryKey: ['meal', mealId, 'changes'],
    queryFn: () => loadStatusChanges(mealId),
  })
}

/** A signed URL for a private photo; refreshed before the one-hour expiry. */
export function useSignedUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['signed-url', path],
    enabled: Boolean(path),
    queryFn: () => getSignedUrl(path!),
    staleTime: 1000 * 60 * 50,
  })
}

/** Signed URLs for many thumbnails in one request (a month of photos). */
export function useSignedUrls(paths: readonly string[]) {
  return useQuery({
    queryKey: ['signed-urls', ...paths],
    enabled: paths.length > 0,
    queryFn: () => getSignedUrls(paths),
    staleTime: 1000 * 60 * 50,
  })
}

/** Record an outcome with an optimistic update, rolled back if the server refuses it. */
export function useSetMealStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recordStatus,
    // Without this, TanStack Query pauses mutations while offline and our own offline queue would
    // never run. `recordStatus` decides what to do when there is no connection.
    networkMode: 'always',
    onMutate: async (input: SetMealStatusInput) => {
      if (!isRecordableStatus(input.status)) return { snapshots: [] }
      await queryClient.cancelQueries({ queryKey: ['today'] })
      const snapshots = queryClient.getQueriesData<TodayEntry[]>({ queryKey: ['today'] })
      queryClient.setQueriesData<TodayEntry[]>({ queryKey: ['today'] }, (old) =>
        old?.map((entry) =>
          entry.meal?.id === input.mealId
            ? {
                ...entry,
                meal: {
                  ...entry.meal,
                  status: input.status,
                  effectiveStatus: input.status,
                  isAutomatic: false,
                  note: input.note ?? entry.meal.note,
                },
              }
            : entry,
        ),
      )
      return { snapshots }
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['today'] })
      void queryClient.invalidateQueries({ queryKey: ['month'] })
      void queryClient.invalidateQueries({ queryKey: ['meal'] })
    },
  })
}

export interface PersonMonthTotals {
  pending: number
  contracted: number
}

/** Pending/contracted per person for a month (one query for the whole household). */
export async function loadMonthTotals(month: PlainDate): Promise<Map<string, PersonMonthTotals>> {
  const { data, error } = await supabase
    .from('monthly_stats')
    .select('person_id, pending, contracted_count')
    .eq('month', month)
  if (error) throw error
  return new Map(data.map((r) => [r.person_id!, { pending: r.pending!, contracted: r.contracted_count! }]))
}

export function useMonthTotals(month: PlainDate, enabled = true) {
  return useQuery({
    // Shares the ['month'] prefix so every status change refreshes it.
    queryKey: ['month', 'totals', monthKey(month)],
    enabled,
    queryFn: () => loadMonthTotals(month),
  })
}

/** The earliest month that already has a plan for a person (bounds how far back Month can go). */
export function useEarliestPlanMonth(personId: string | undefined) {
  return useQuery({
    queryKey: ['month', 'earliest', personId],
    enabled: Boolean(personId),
    queryFn: async (): Promise<PlainDate | null> => {
      const { data, error } = await supabase
        .from('monthly_plans')
        .select('month')
        .eq('person_id', personId!)
        .order('month', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data ? (data.month as PlainDate) : null
    },
  })
}

export function useHistory(personId: string | undefined) {
  return useQuery({
    queryKey: ['month', 'history', personId],
    enabled: Boolean(personId),
    queryFn: () => loadHistory(personId!),
  })
}

export function useMonthMeals(personId: string, month: PlainDate) {
  return useQuery({
    queryKey: ['month', 'meals', personId, monthKey(month)],
    enabled: Boolean(personId),
    queryFn: () => loadMonthMeals(personId, month, monthEnd(month)),
  })
}
