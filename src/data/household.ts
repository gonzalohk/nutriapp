import { supabase } from './supabase'

export interface Member {
  userId: string
  displayName: string
  role: 'owner' | 'adult'
}

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase.from('household_members').select('user_id, display_name, role').order('created_at')
  if (error) throw error
  return data.map((m) => ({ userId: m.user_id, displayName: m.display_name, role: m.role }))
}

/** A single-use invitation code, valid for 7 days. */
export async function createInvite(): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite')
  if (error) throw error
  return data
}
