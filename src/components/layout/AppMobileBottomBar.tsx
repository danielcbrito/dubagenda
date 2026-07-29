import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  CartNavIcon,
  HomeNavIcon,
  PlanNavIcon,
  ProfileNavIcon,
} from "./AppNavIcons";

interface AppMobileNavProps {
  /** Prefixo das rotas, ex: "/cliente" */
  basePath?: string;
  /** Contador exibido sobre o ícone da Loja */
  badgeCount?: number;
}

const items = [
  { key: "inicio", label: "Início", path: "", end: true, Icon: HomeNavIcon, badge: false },
  { key: "loja", label: "Loja", path: "/loja", end: false, Icon: CartNavIcon, badge: true },
  { key: "plano", label: "Plano", path: "/assinar", end: false, Icon: CrownNavIcon, badge: false },
  { key: "perfil", label: "Perfil", path: "/perfil", end: false, Icon: ProfileNavIcon, badge: false },
];

export function AppMobileBottomBar({
  basePath = "/cliente",
  badgeCount = 0,
}: AppMobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className="fixed left-0 right-0 z-50 border-t border-border/60 bg-background overflow-visible"
      style={{
        bottom: "var(--app-bottom-nav-offset, 0px)",
        paddingBottom: "var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* bleed: evita faixa branca embaixo no PWA iOS */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 translate-y-full bg-background"
        style={{ height: "var(--app-bottom-nav-bleed, 0px)" }}
      />

      <div className="flex items-start justify-around px-2 pt-2.5 pb-2">
        {items.map(({ key, label, path, end, Icon, badge }) => {
          const to = `${basePath}${path}`;
          return (
            <NavLink
              key={key}
              to={to}
              end={end}
              onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                if (location.pathname !== to) navigate(to);
              }}
              onClick={(e) => e.preventDefault()}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1.5 px-2 pt-1 pb-0.5 transition-colors duration-150 touch-manipulation select-none",
                  isActive ? "text-accent-red" : "text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon active={isActive} className="h-[26px] w-[26px]" />
                    {badge && badgeCount > 0 && (
                      <span className="absolute -top-2 -right-2.5 min-w-[19px] h-[19px] px-1 rounded-full bg-accent-red text-white text-[10px] font-bold flex items-center justify-center leading-none tabular-nums ring-2 ring-background">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </div>

                  <span
                    className={cn(
                      "text-[12px] leading-none",
                      isActive ? "font-semibold" : "font-medium"
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
