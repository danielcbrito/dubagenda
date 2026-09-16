import { Outlet, useLocation } from "react-router-dom";
import { BottomNavigation } from "@/components/BottomNavigation";
import { cn } from "@/lib/utils";

const RESERVED_SLUGS = [
  "cliente", "suporte", "admin", "auth", "barbearias", "b", "i",
  "escolher-barbearia", "escolher-verificacao", "verificar-email",
  "verificar-whatsapp", "completar-perfil", "esqueci-senha",
  "resetar-senha", "flowchart", "responsive-preview"
];

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

  const segs = path.split("/").filter(Boolean);
  const isBarbershopPublic =
    path.startsWith("/b/") ||
    path.startsWith("/barbearia-dub/") ||
    ((segs.length === 1 || segs.length === 2) && !RESERVED_SLUGS.includes(segs[0]));

  const isImmersive = path === "/escolher-barbearia" || isBarbershopPublic;

  return (
    <div
      className={cn(
        "relative h-full w-full touch-pan-y overflow-hidden antialiased flex flex-col",
        isImmersive ? "bg-transparent" : "bg-white"
      )}
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
