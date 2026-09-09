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
    "/cliente/assinar",
  ];
  const shouldShowNav =
    isClientRoute && !hideNavPatterns.some((p) => path.startsWith(p));

  return (
    <div
      className="relative h-full w-full touch-pan-y overflow-hidden bg-white antialiased flex flex-col"
    >
      {/* Background limpo e 100% branco sem orbs cinzas */}
      {isClientRoute && !path.startsWith("/cliente/agendar") && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-white" />
      )}

      <div className="relative z-10 flex-1 min-h-0 h-full w-full">
        <Outlet />
      </div>
      {shouldShowNav && <BottomNavigation />}
    </div>
  );

}
