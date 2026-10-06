import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { Button } from '@/components/Button'
import { supabase } from '@/data/supabase'
import { errorMessage } from '@/data/errors'
import { t } from '@/i18n/t'
import { AuthLayout, Field } from './AuthLayout'
import { useAuth } from './AuthProvider'

/** First run: create the household. Refused by the database once one already exists. */
export function SetupPage() {
  const { refreshMembership, signOut } = useAuth()
  const [, navigate] = useLocation()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('create_household', {
      p_name: name,
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

  return (
    <AuthLayout title={t('auth.setupTitle')}>
      <p className="text-center text-slate-700">{t('auth.noHousehold')}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.householdName')} required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={t('auth.displayName')} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" block disabled={busy}>
          {t('auth.createHousehold')}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/join" className="text-brand underline">
          {t('auth.orJoin')}
        </Link>
      </p>
      <Button variant="ghost" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
    </AuthLayout>
  )
}
