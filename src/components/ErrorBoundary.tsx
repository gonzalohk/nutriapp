import { Component, type ReactNode } from 'react'
import { t } from '@/i18n/t'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="p-6 text-center">
        <p className="mb-3">{t('common.error')}</p>
        <button className="min-h-12 rounded-xl border border-slate-300 px-4 font-semibold" onClick={() => location.reload()}>
          {t('common.retry')}
        </button>
      </div>
    )
  }
}
