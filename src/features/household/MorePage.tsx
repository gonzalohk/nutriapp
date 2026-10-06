import { Link } from 'wouter'
import { Button } from '@/components/Button'
import { useAuth, useHousehold } from '@/features/auth/AuthProvider'
import { t, type MessageKey } from '@/i18n/t'

const ITEMS: { href: string; icon: string; label: MessageKey }[] = [
  { href: '/more/people', icon: '👥', label: 'more.people' },
  { href: '/more/holidays', icon: '🗓', label: 'more.holidays' },
  { href: '/more/household', icon: '🏠', label: 'more.household' },
  { href: '/report', icon: '📄', label: 'more.report' },
  { href: '/more/export', icon: '⬇', label: 'more.export' },
]

export function MorePage() {
  const { signOut } = useAuth()
  const { displayName } = useHousehold()
  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">{t('more.title')}</h1>
      <p className="text-slate-700">{t('more.signedInAs', { name: displayName })}</p>
      <ul className="flex flex-col gap-2">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-lg font-semibold">
              <span aria-hidden="true">{item.icon}</span>
              {t(item.label)}
            </Link>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
    </section>
  )
}
