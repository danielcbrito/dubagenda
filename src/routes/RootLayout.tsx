import { Outlet, useLocation } from "react-router-dom";
import { BottomNavigation } from "@/components/BottomNavigation";

/** Mobile-first root layout: centered container with fixed bottom nav on client routes. */
export function RootLayout() {
  const location = useLocation();
  const path = location.pathname;
  const isClientRoute = path.startsWith("/cliente");
  // Rotas de fluxo imersivo (agendamento, checkout, pagamento) escondem a bottom nav
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
      <Outlet />
      {shouldShowNav && <BottomNavigation />}
    </div>
  );

}
