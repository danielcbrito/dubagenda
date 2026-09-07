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
      className="relative h-full h-dvh w-full touch-pan-y overflow-hidden bg-[#FBFBFA] antialiased flex flex-col"
    >
      {/* Background ambient orbs estratégicos e suaves (idêntico ao plano) */}
      {isClientRoute && !path.startsWith("/cliente/agendar") && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#FBFBFA]">
          <div className="absolute -top-[12%] -left-[10%] w-[420px] h-[420px] rounded-full bg-[#EAE8E3]/70 blur-[130px]" />
          <div className="absolute top-[25%] -right-[15%] w-[380px] h-[380px] rounded-full bg-[#F5EBE1]/60 blur-[140px]" />
          <div className="absolute -bottom-[10%] left-[15%] w-[380px] h-[380px] rounded-full bg-[#E5E9EC]/50 blur-[130px]" />
        </div>
      )}

      <div className="relative z-10 flex-1 min-h-0 h-full w-full">
        <Outlet />
      </div>
      {shouldShowNav && <BottomNavigation />}
    </div>
  );

}
