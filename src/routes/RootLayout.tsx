import { Outlet, useLocation } from "react-router-dom";
import { BottomNavigation } from "@/components/BottomNavigation";

/** Mobile-first root layout: centered container with fixed bottom nav on client routes. */
export function RootLayout() {
  const location = useLocation();
  const isClientRoute = location.pathname.startsWith("/cliente");

  return (
    <div className="relative mx-auto min-h-screen max-w-lg touch-pan-y overflow-x-hidden bg-white pb-24 antialiased">
      <Outlet />
      {isClientRoute && <BottomNavigation />}
    </div>
  );
}
