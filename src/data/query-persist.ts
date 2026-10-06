import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

const KEY = 'nutrilara-query-cache'

/** Keeps the last loaded data on the device so the app opens offline. */
export const queryPersister: Persister = {
  persistClient: (client: PersistedClient) => set(KEY, client),
  restoreClient: () => get<PersistedClient>(KEY),
  removeClient: () => del(KEY),
}

/** Short-lived or derived data is never written to disk. */
const NOT_PERSISTED = new Set(['signed-url', 'signed-urls', 'preview'])

export const persistOptions = {
  persister: queryPersister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
  // A new app version drops the old cache instead of reading it with the wrong shape.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string }; queryKey: readonly unknown[] }) =>
      query.state.status === 'success' && !NOT_PERSISTED.has(String(query.queryKey[0])),
  },
}
