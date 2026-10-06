import type { ReactNode } from 'react'
import { t } from '@/i18n/t'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <p className="text-3xl font-extrabold text-brand">🥗 {t('app.name')}</p>
        <h1 className="mt-2 text-xl font-bold">{title}</h1>
      </header>
      {children}
    </main>
  )
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" {...input} />
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  )
}
