import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

/**
 * Camadas de cache:
 *  1. localStorage (persistido entre sessões) — pinta a tela instantaneamente.
 *  2. TanStack Query em memória — dedupe entre telas.
 *  3. Revalidação em background (stale-while-revalidate).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Nunca mostra skeleton se já existe dado em cache: usa o cache e revalida atrás.
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: (n) => Math.min(1000 * 2 ** n, 10000),
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      placeholderData: (prev: unknown) => prev,
    },
    mutations: { retry: 0 },
  },
});

const CACHE_KEY = "dub-query-cache-v1";

/** Queries que NUNCA devem ser persistidas (dados sensíveis / voláteis). */
const NON_PERSISTED = ["pix", "checkout", "payment", "slots", "availability", "support"];

export function setupQueryPersistence() {
  if (typeof window === "undefined") return;

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: CACHE_KEY,
    throttleTime: 1000,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000,
    buster: "v1",
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        if (query.state.status !== "success") return false;
        const key = JSON.stringify(query.queryKey).toLowerCase();
        return !NON_PERSISTED.some((k) => key.includes(k));
      },
    },
  });
}

/** Limpa o cache persistido (usar no logout). */
export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
  queryClient.clear();
}
