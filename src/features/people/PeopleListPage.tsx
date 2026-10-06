import { useState } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { errorMessage } from '@/data/errors'
import { usePeople } from '@/data/queries'
import type { Person } from '@/data/types'
import { t } from '@/i18n/t'
import { PersonForm } from './PersonForm'
import { PlanTermsForm } from './PlanTermsForm'
import { usePeopleActions } from './usePeopleActions'

/** People of the household. There is no permanent delete: people are deactivated and can return. */
export function PeopleListPage() {
  const people = usePeople()
  const { deactivate, reactivate } = usePeopleActions()
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [leaving, setLeaving] = useState<Person | null>(null)
  const [planOf, setPlanOf] = useState<Person | null>(null)

  if (people.isPending) return <Spinner />
  if (people.isError) return <ErrorState message={errorMessage(people.error)} onRetry={() => void people.refetch()} />

  return (
    <section className="flex flex-col gap-3 p-4">
      <Link href="/more" className="inline-flex min-h-12 items-center font-semibold text-brand">‹ {t('common.back')}</Link>
      <h1 className="text-2xl font-bold">{t('people.title')}</h1>
      {people.data.length === 0 && <EmptyState>{t('people.empty')}</EmptyState>}
      <ul className="flex flex-col gap-2">
        {people.data.map((p) => (
          <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-bold">
                  {p.first_name} {p.last_name ?? ''}
                </p>
                <p className="text-sm text-slate-600">{p.active ? `✔ ${t('people.active')}` : `⏸ ${t('people.inactive')}`}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => setEditing(p)}>{t('people.edit')}</Button>
                <Button variant="ghost" onClick={() => setPlanOf(p)}>{t('plan.open')}</Button>
                {p.active ? (
                  <Button variant="ghost" onClick={() => setLeaving(p)}>{t('people.deactivate')}</Button>
                ) : (
                  <Button variant="ghost" disabled={reactivate.isPending} onClick={() => reactivate.mutate(p)}>{t('people.reactivate')}</Button>
                )}
              </div>
            </div>
            {!p.active && <p className="mt-1 text-xs text-slate-600">{t('people.reactivateHint')}</p>}
          </li>
        ))}
      </ul>
      {(deactivate.error || reactivate.error) && (
        <p role="alert" className="text-sm text-red-800">{errorMessage(deactivate.error ?? reactivate.error)}</p>
      )}
      <Button onClick={() => setEditing('new')}>＋ {t('people.add')}</Button>

      {editing && <PersonForm person={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {planOf && <PlanTermsForm person={planOf} onClose={() => setPlanOf(null)} />}
      {leaving && (
        <ConfirmDialog
          danger
          title={t('people.deactivateTitle', { name: leaving.first_name })}
          message={t('people.deactivateMessage')}
          confirmLabel={t('people.deactivate')}
          onCancel={() => setLeaving(null)}
          onConfirm={() => {
            deactivate.mutate(leaving)
            setLeaving(null)
          }}
        />
      )}
    </section>
  )
}
