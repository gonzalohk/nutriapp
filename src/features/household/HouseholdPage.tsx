import { useState } from 'react'
import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { errorMessage } from '@/data/errors'
import { createInvite, fetchMembers } from '@/data/household'
import { t } from '@/i18n/t'

/** Members of the household and single-use invitation codes (any member can invite). */
export function HouseholdPage() {
  const members = useQuery({ queryKey: ['members'], queryFn: fetchMembers })
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function invite() {
    setBusy(true)
    setError(null)
    try {
      setCode(await createInvite())
    } catch (e) {
      setError(errorMessage(e))
    }
    setBusy(false)
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <Link href="/more" className="inline-flex min-h-12 items-center font-semibold text-brand">‹ {t('common.back')}</Link>
      <h1 className="text-2xl font-bold">{t('household.title')}</h1>

      <h2 className="text-xl font-bold">{t('household.members')}</h2>
      {members.isPending && <Spinner />}
      {members.isError && <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} />}
      <ul className="flex flex-col gap-2">
        {members.data?.map((m) => (
          <li key={m.userId} className="rounded-2xl border border-slate-200 bg-white p-3 font-semibold">
            {m.displayName} {m.role === 'owner' && <span className="text-sm font-normal text-slate-600">({t('household.owner')})</span>}
          </li>
        ))}
      </ul>

      <Button onClick={() => void invite()} disabled={busy}>{t('household.createInvite')}</Button>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {code && (
        <div className="rounded-2xl border border-slate-300 bg-white p-4 text-center">
          <p className="text-sm text-slate-600">{t('household.inviteHint')}</p>
          <p data-testid="invite-code" className="mt-2 select-all break-all font-mono text-2xl font-bold">{code}</p>
        </div>
      )}
    </section>
  )
}
