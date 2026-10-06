import { toPlainDate, type PlainDate } from '@/domain/plain-date'
import { supabase } from './supabase'

export interface HolidayItem {
  date: PlainDate
  name: string
  source: 'official' | 'custom'
}

export interface ExceptionalItem {
  date: PlainDate
  note: string | null
}

export async function fetchYearHolidays(year: number): Promise<HolidayItem[]> {
  const { data, error } = await supabase
    .from('effective_holidays')
    .select('holiday_date, name, source')
    .gte('holiday_date', `${year}-01-01`)
    .lte('holiday_date', `${year}-12-31`)
    .order('holiday_date')
  if (error) throw error
  return data.map((h) => ({
    date: toPlainDate(h.holiday_date!),
    name: h.name ?? '',
    source: h.source === 'custom' ? 'custom' : 'official',
  }))
}

export async function fetchExceptionalList(): Promise<ExceptionalItem[]> {
  const { data, error } = await supabase
    .from('exceptional_delivery_dates')
    .select('delivery_date, note')
    .order('delivery_date')
  if (error) throw error
  return data.map((r) => ({ date: toPlainDate(r.delivery_date), note: r.note }))
}

export async function addHoliday(date: PlainDate, name: string): Promise<void> {
  const { error } = await supabase.rpc('add_holiday', { p_date: date, p_name: name })
  if (error) throw error
}

export async function removeHoliday(date: PlainDate): Promise<void> {
  const { error } = await supabase.rpc('remove_holiday', { p_date: date })
  if (error) throw error
}
