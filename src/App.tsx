import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, Route, Switch } from 'wouter'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Spinner } from '@/components/Spinner'
import { TabBar } from '@/components/TabBar'
import { startAutoSync } from '@/data/sync'
import { isConfigured } from '@/data/supabase'
import { ConnectivityChip } from '@/components/ConnectivityChip'
import { UpdatePrompt } from '@/pwa/UpdatePrompt'
import { useAuth } from '@/features/auth/AuthProvider'
import { JoinPage } from '@/features/auth/JoinPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetupPage } from '@/features/auth/SetupPage'
import { EnsureCurrentMonths } from '@/features/month/EnsureCurrentMonths'
import { TodayPage } from '@/features/today/TodayPage'
import { t } from '@/i18n/t'

// Only the Today screen and sign-in are in the first download; the rest load when opened.
const ExportPage = lazy(() =>
  import('@/features/export/ExportPage').then((m) => ({ default: m.ExportPage })),
)
const ReportPage = lazy(() =>
  import('@/features/export/ReportPage').then((m) => ({ default: m.ReportPage })),
)
const HolidaysPage = lazy(() =>
  import('@/features/holidays/HolidaysPage').then((m) => ({ default: m.HolidaysPage })),
)
const HouseholdPage = lazy(() =>
  import('@/features/household/HouseholdPage').then((m) => ({ default: m.HouseholdPage })),
)
const MealSheet = lazy(() =>
  import('@/features/meal/MealSheet').then((m) => ({ default: m.MealSheet })),
)
const PeopleListPage = lazy(() =>
  import('@/features/people/PeopleListPage').then((m) => ({ default: m.PeopleListPage })),
)
const HistoryPage = lazy(() =>
  import('@/features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })),
)
const MonthDetail = lazy(() =>
  import('@/features/history/MonthDetail').then((m) => ({ default: m.MonthDetail })),
)
const MonthPage = lazy(() =>
  import('@/features/month/MonthPage').then((m) => ({ default: m.MonthPage })),
)
const MorePage = lazy(() =>
  import('@/features/household/MorePage').then((m) => ({ default: m.MorePage })),
)

function AppShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  useEffect(() => startAutoSync(queryClient), [queryClient])
  return (
    <div className="mx-auto min-h-full max-w-2xl pb-20 print:pb-0">
      <EnsureCurrentMonths />
      <ConnectivityChip />
      {children}
      <TabBar />
      <UpdatePrompt />
    </div>
  )
}

export function App() {
  const { state } = useAuth()

  if (!isConfigured) {
    return (
      <p role="alert" className="p-6 text-red-800">
        {t('auth.configMissing')}
      </p>
    )
  }
  if (state.status === 'loading') return <Spinner />

  // Signed-out users only reach login or the invite screen; everything else redirects to login.
  if (state.status === 'signedOut') {
    return (
      <Switch>
        <Route path="/join" component={JoinPage} />
        <Route path="/login" component={LoginPage} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    )
  }

  if (state.status === 'noHousehold') {
    return (
      <Switch>
        <Route path="/join" component={JoinPage} />
        <Route path="/setup" component={SetupPage} />
        <Route>
          <Redirect to="/setup" />
        </Route>
      </Switch>
    )
  }

  return (
    <ErrorBoundary>
      <AppShell>
        <Suspense fallback={<Spinner />}>
          <Switch>
            <Route path="/" component={TodayPage} />
            <Route path="/month" component={MonthPage} />
            <Route path="/history/:person/:month">
              {(params) => <MonthDetail personId={params.person} monthKeyValue={params.month} />}
            </Route>
            <Route path="/history" component={HistoryPage} />
            <Route path="/meal/:id">{(params) => <MealSheet mealId={params.id} />}</Route>
            <Route path="/more/people" component={PeopleListPage} />
            <Route path="/more/holidays" component={HolidaysPage} />
            <Route path="/more/household" component={HouseholdPage} />
            <Route path="/more/export" component={ExportPage} />
            <Route path="/report/:month">
              {(params) => <ReportPage monthKeyValue={params.month} />}
            </Route>
            <Route path="/report">{() => <ReportPage />}</Route>
            <Route path="/more" component={MorePage} />
            <Route>
              <Redirect to="/" />
            </Route>
          </Switch>
        </Suspense>
      </AppShell>
    </ErrorBoundary>
  )
}
