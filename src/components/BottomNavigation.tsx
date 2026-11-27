import { ShoppingCart, Scissors, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/** Facebook-style outlined house icon — same shape in every state, color changes only. */
function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12 3.4c.35 0 .69.13.96.36l7.5 6.57c.32.28.5.69.5 1.11v7.81A1.75 1.75 0 0 1 19.21 21H15.5a1 1 0 0 1-1-1v-4.5a2.5 2.5 0 1 0-5 0V20a1 1 0 0 1-1 1H4.79A1.75 1.75 0 0 1 3.04 19.25v-7.81c0-.42.18-.83.5-1.11l7.5-6.57c.27-.23.61-.36.96-.36z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  isActive?: boolean;
  onClick: () => void;
  badge?: number;
  label: string;
}

function NavItem({ icon: Icon, isActive, onClick, badge, label }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "relative flex items-center justify-center h-[48px] cursor-pointer focus:outline-hidden transition-all duration-300 ease-in-out",
        isActive ? "px-3 rounded-full bg-white text-black" : "w-[48px] rounded-full text-white bg-transparent"
      )}
    >
      <div className="relative flex items-center justify-center">
        <Icon
          className={cn(
            "relative z-10 w-[22px] h-[22px] transition-colors duration-200",
            isActive ? "text-black stroke-[2.2]" : "text-white stroke-[1.8]"
          )}
        />
        {typeof badge === "number" && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#DC2626] text-white text-[9px] font-black flex items-center justify-center leading-none z-20 shadow-xs ring-2 ring-[#0A0A0A]">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap",
          isActive ? "max-w-[90px] ml-1.5 opacity-100" : "max-w-0 ml-0 opacity-0"
        )}
      >
        <span className="text-[13px] font-medium block">
          {label}
        </span>
      </div>
    </button>
  );
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      userId = s?.user?.id ?? null;
      recount();
    });

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("dub_cart_")) recount();
    };
    const onCustom = () => recount();

    window.addEventListener("storage", onStorage);
    window.addEventListener("dub:cart-changed", onCustom);
    const onVisible = () => { if (document.visibilityState === "visible") recount(); };
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

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = useCartBadge();

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Preenchimento contínuo 100% na cor da barra (#0A0A0A) para cobrir totalmente a área dos botões do celular */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[59] bg-[#0A0A0A] pointer-events-none"
        style={{
          height: "max(calc(env(safe-area-inset-bottom, 0px) + 36px), 50px)",
        }}
        aria-hidden="true"
      />

      <nav
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#0A0A0A]"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 28px)",
        }}
      >
        {/* Sangria para baixo de 250px na cor #0A0A0A para eliminar qualquer fresta ou área branca abaixo da barra */}
        <div
          className="absolute top-full left-0 right-0 h-64 bg-[#0A0A0A] pointer-events-none"
          aria-hidden="true"
        />

        {/* Inverted Corners (Curvinhas ao contrário nas laterais) */}
        <div className="absolute -top-[20px] left-0 w-full flex justify-between pointer-events-none">
          {/* Left Corner */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#0A0A0A]">
            <path d="M0 24V0C0 13.2548 10.7452 24 24 24H0Z" fill="currentColor" />
          </svg>
          {/* Right Corner */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#0A0A0A]">
            <path d="M24 24V0C24 13.2548 13.2548 24 0 24H24Z" fill="currentColor" />
          </svg>
        </div>

        <div className="mx-auto flex h-[64px] w-full max-w-sm items-center justify-around px-2 pt-1 pb-1">
          <NavItem
            icon={HomeIcon}
            label="Início"
            isActive={isActive("/cliente")}
            onClick={() => navigate("/cliente")}
          />
          <NavItem
            icon={ShoppingCart}
            label="Loja"
            badge={cartCount}
            isActive={isActive("/cliente/loja")}
            onClick={() => navigate("/cliente/loja")}
          />
          <NavItem
            icon={Scissors}
            label="Planos"
            isActive={isActive("/cliente/assinar")}
            onClick={() => navigate("/cliente/assinar")}
          />
          <NavItem
            icon={User}
            label="Perfil"
            isActive={isActive("/cliente/perfil")}
            onClick={() => navigate("/cliente/perfil")}
          />
        </div>

        {/* Overscroll protection for iOS Home Indicator & physical bottom */}
        <div className="absolute top-full left-0 right-0 h-[250px] bg-[#0A0A0A] pointer-events-none" />
      </nav>

      {/* Persistent solid black filler for the absolute bottom edge of the phone */}
      <div 
        className="fixed -bottom-[120px] left-0 right-0 h-[150px] bg-[#0A0A0A] pointer-events-none z-[59]" 
        aria-hidden="true" 
      />
    </>
  );
}
