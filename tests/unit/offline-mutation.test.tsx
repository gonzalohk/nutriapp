// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ recordStatus: vi.fn() }))
vi.mock('@/data/sync', () => ({ recordStatus: mocks.recordStatus }))
vi.mock('@/data/supabase', () => ({ supabase: {}, isConfigured: true }))

import { useSetMealStatus } from '@/data/queries'

afterEach(() => onlineManager.setOnline(true))

describe('recording a status without a connection', () => {
  it('still runs our own offline handling instead of waiting for the network (regression)', async () => {
    mocks.recordStatus.mockResolvedValue('queued')
    onlineManager.setOnline(false)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useSetMealStatus(), { wrapper })
    await act(async () => {
      result.current.mutate({ mealId: 'm1', status: 'picked_up' })
    })
    await waitFor(() => expect(mocks.recordStatus).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
