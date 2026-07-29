import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppMobileBottomBar } from "@/components/layout/AppMobileBottomBar";
import { supabase } from "@/integrations/supabase/client";

/** Fallback leve: mantém a barra de navegação visível enquanto o chunk da rota carrega. */
function RouteFallback() {
  return <div className="min-h-dvh w-full bg-background" aria-hidden />;
}

/** Reads total cart quantity across all tenant-scoped carts for the current user. */
function useCartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let userId: string | null = null;

    const recount = () => {
      if (!userId) {
        setCount(0);
        return;
      }
      let total = 0;
      try {
        const prefix = `dub_cart_${userId}__`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(prefix)) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const it of parsed) total += Number(it?.quantidade) || 0;
          }
        }
      } catch {
        // ignore
      }
      setCount(total);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      userId = session?.user?.id ?? null;
      recount();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      userId = s?.user?.id ?? null;
      recount();
    });

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("dub_cart_")) recount();
    };
    const onCustom = () => recount();
    const onVisible = () => {
      if (document.visibilityState === "visible") recount();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("dub:cart-changed", onCustom);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dub:cart-changed", onCustom);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return count;
}

/** Mobile-first root layout: centered container with fixed bottom nav on client routes. */
export function RootLayout() {
  const location = useLocation();
  const path = location.pathname;
  const isClientRoute = path.startsWith("/cliente");
  const cartCount = useCartBadge();
  // Rotas de fluxo imersivo (agendamento, checkout, pagamento) escondem a bottom nav.
  // "/cliente/assinar" NÃO entra aqui: a barra permanece visível ao abrir Planos.
  const hideNavPatterns = [
    "/cliente/agendar",
    "/cliente/pagamento",
    "/cliente/pix-checkout",
    "/cliente/subscription-pix",
  ];
  const shouldShowNav =
    isClientRoute && !hideNavPatterns.some((p) => path.startsWith(p));

  return (
    <div
      className="relative min-h-dvh w-full touch-pan-y overflow-x-hidden bg-background antialiased"
      style={
        shouldShowNav
          ? {
              paddingBottom:
                "calc(6rem + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)))",
            }
          : undefined
      }
    >
      {/* Suspense fica DENTRO do layout para a bottom nav nunca desmontar na troca de rota */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      {shouldShowNav && (
        <AppMobileBottomBar basePath="/cliente" badgeCount={cartCount} />
      )}
    </div>
  );
}
