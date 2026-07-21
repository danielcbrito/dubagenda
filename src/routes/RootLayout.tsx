import { Outlet, useLocation } from "react-router-dom";
import { BottomNavigation } from "@/components/BottomNavigation";

/** Mobile-first root layout: centered container with fixed bottom nav on client routes. */
export function RootLayout() {
  const location = useLocation();
  const isClientRoute = location.pathname.startsWith("/cliente");

  return (
    <div
      className="relative min-h-dvh w-full touch-pan-y overflow-x-hidden bg-background antialiased"
      style={
        isClientRoute
          ? { paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }
          : undefined
      }
    >
      <Outlet />
      {isClientRoute && <BottomNavigation />}
    </div>
  );

}
