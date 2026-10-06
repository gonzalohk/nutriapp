import { Link, useLocation } from 'wouter'
import { t, type MessageKey } from '@/i18n/t'

const TABS: { href: string; match: (path: string) => boolean; icon: string; label: MessageKey }[] = [
  { href: '/', match: (p) => p === '/', icon: '🍽', label: 'tab.today' },
  { href: '/month', match: (p) => p.startsWith('/month'), icon: '📅', label: 'tab.month' },
  { href: '/history', match: (p) => p.startsWith('/history'), icon: '🕑', label: 'tab.history' },
  { href: '/more', match: (p) => p.startsWith('/more'), icon: '⋯', label: 'tab.more' },
]

export function TabBar() {
  const [path] = useLocation()
  return (
    <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-30 print:hidden border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active = tab.match(path)
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center text-xs font-semibold ${active ? 'text-brand' : 'text-slate-600'}`}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {tab.icon}
                </span>
                {t(tab.label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
