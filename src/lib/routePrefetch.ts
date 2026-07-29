/**
 * Prefetch dos chunks das rotas mais usadas do app do cliente.
 * Roda em idle para não competir com o first paint.
 */
let done = false;

export function prefetchClientRoutes() {
  if (done || typeof window === "undefined") return;
  done = true;

  const run = () => {
    void import("@/pages/Cliente");
    void import("@/pages/ClienteAgendar");
    void import("@/pages/ClientePerfil");
    void import("@/pages/ClienteAssinar");
    void import("@/pages/ClienteLoja");
  };

  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;

  if (ric) ric(run, { timeout: 3000 });
  else window.setTimeout(run, 1200);
}
