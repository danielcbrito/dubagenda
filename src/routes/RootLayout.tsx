import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppMobileBottomBar } from "@/components/layout/AppMobileBottomBar";
import { supabase } from "@/integrations/supabase/client";

/** Fallback leve: mantém a barra de navegação visível enquanto o chunk da rota carrega. */
function RouteFallback() {
  return <div className="min-h-dvh w-full bg-background" aria-hidden />;
}

/** Mobile-first root layout: centered container with fixed bottom nav on client routes. */
export function RootLayout() {
  const location = useLocation();
  const path = location.pathname;
  const isClientRoute = path.startsWith("/cliente");
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
          ? { paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }
          : undefined
      }
    >
      {/* Suspense fica DENTRO do layout para a bottom nav nunca desmontar na troca de rota */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      {shouldShowNav && <BottomNavigation />}
    </div>
  );
}
