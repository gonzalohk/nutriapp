import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { Button } from '@/components/Button'
import { supabase } from '@/data/supabase'
import { errorMessage } from '@/data/errors'
import { t } from '@/i18n/t'
import { AuthLayout, Field } from './AuthLayout'
import { useAuth } from './AuthProvider'

/** Join an existing household with a single-use invite code created by any member. */
export function JoinPage() {
  const { state, refreshMembership } = useAuth()
  const [, navigate] = useLocation()
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('join_household', {
      p_code: code.trim(),
      p_display_name: displayName,
    })
    if (rpcError) {
      setError(errorMessage(rpcError))
      setBusy(false)
      return
    }
    await refreshMembership()
    navigate('/')
  }

  // Sign-in comes first: the code is redeemed by a signed-in account.
  if (state.status === 'signedOut') {
    return (
      <AuthLayout title={t('auth.joinTitle')}>
        <Link href="/login" className="text-center text-brand underline">
          {t('auth.signIn')} / {t('auth.signUp')}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.joinTitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.inviteCode')} required autoCapitalize="none" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
        <Field label={t('auth.displayName')} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" block disabled={busy}>
          {t('auth.join')}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/setup" className="text-brand underline">
          {t('auth.orCreate')}
        </Link>
      </p>
    </AuthLayout>
  )
}
