import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ENSURE_KEY } from '@/data/ensure'
import { createPerson, deactivatePerson, reactivatePerson, renamePerson, type NewPerson } from '@/data/people-actions'
import { keys } from '@/data/queries'
import type { Person } from '@/data/types'
import { todayInBolivia } from '@/domain/bolivia-time'

/** Person actions that refresh everything that depends on who is in the plan. */
export function usePeopleActions() {
  const queryClient = useQueryClient()
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: keys.people })
    await queryClient.invalidateQueries({ queryKey: [ENSURE_KEY] })
    await queryClient.invalidateQueries({ queryKey: ['month'] })
    await queryClient.invalidateQueries({ queryKey: ['today'] })
  }
  const create = useMutation({ mutationFn: (p: NewPerson) => createPerson(p, todayInBolivia()), onSuccess: refresh })
  const rename = useMutation({
    mutationFn: (v: { person: Person; firstName: string; lastName: string }) => renamePerson(v.person, v.firstName, v.lastName),
    onSuccess: refresh,
  })
  const deactivate = useMutation({ mutationFn: (p: Person) => deactivatePerson(p, todayInBolivia()), onSuccess: refresh })
  const reactivate = useMutation({ mutationFn: (p: Person) => reactivatePerson(p, todayInBolivia()), onSuccess: refresh })
  return { create, rename, deactivate, reactivate }
}
