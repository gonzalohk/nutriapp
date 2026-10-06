import { useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/Button'
import { supabase } from '@/data/supabase'
import { t } from '@/i18n/t'
import { AuthLayout, Field } from './AuthLayout'

/** Email + password sign-in and sign-up. A new account sees no data until it has a household. */
export function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: authError } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (authError) setError(authError.message)
    setBusy(false)
  }

  return (
    <AuthLayout title={mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label={t('auth.password')}
          hint={mode === 'signUp' ? t('auth.passwordHint') : undefined}
          type="password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" block disabled={busy}>
          {mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-700">
        {mode === 'signIn' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
        <button className="min-h-12 font-semibold text-brand underline" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          {mode === 'signIn' ? t('auth.signUp') : t('auth.signIn')}
        </button>
      </p>
      <p className="text-center text-sm">
        <Link href="/join" className="text-brand underline">
          {t('auth.haveInvite')}
        </Link>
      </p>
    </AuthLayout>
  )
}
