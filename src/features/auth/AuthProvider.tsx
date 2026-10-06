import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { clearOutbox } from '@/data/outbox'
import { queryPersister } from '@/data/query-persist'
import { supabase } from '@/data/supabase'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noHousehold'; userId: string }
  | { status: 'ready'; userId: string; householdId: string; displayName: string }

interface AuthContextValue {
  state: AuthState
  signOut: () => Promise<void>
  /** Re-read the household membership after creating or joining one. */
  refreshMembership: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const membership = useQuery({
    queryKey: ['membership', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, display_name')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const refreshMembership = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['membership'] })
  }, [queryClient])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // Nothing of this household stays on a phone that signed out.
    queryClient.clear()
    await queryPersister.removeClient()
    await clearOutbox()
  }, [queryClient])

  const state = useMemo<AuthState>(() => {
    if (session === undefined) return { status: 'loading' }
    if (!session) return { status: 'signedOut' }
    if (membership.isPending) return { status: 'loading' }
    if (!membership.data) return { status: 'noHousehold', userId: session.user.id }
    return {
      status: 'ready',
      userId: session.user.id,
      householdId: membership.data.household_id,
      displayName: membership.data.display_name,
    }
  }, [session, membership.isPending, membership.data])

  const value = useMemo(() => ({ state, signOut, refreshMembership }), [state, signOut, refreshMembership])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** The signed-in user's household; only call inside screens guarded to the `ready` state. */
export function useHousehold(): { userId: string; householdId: string; displayName: string } {
  const { state } = useAuth()
  if (state.status !== 'ready') throw new Error('useHousehold called before the household is ready')
  return state
}
