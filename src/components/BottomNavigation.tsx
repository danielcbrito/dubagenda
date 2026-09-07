import { ShoppingCart, Scissors, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type SVGProps } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Facebook-style outlined house icon — same shape in every state, color changes only. */
function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12 3.4c.35 0 .69.13.96.36l7.5 6.57c.32.28.5.69.5 1.11v7.81A1.75 1.75 0 0 1 19.21 21H15.5a1 1 0 0 1-1-1v-4.5a2.5 2.5 0 1 0-5 0V20a1 1 0 0 1-1 1H4.79A1.75 1.75 0 0 1 3.04 19.25v-7.81c0-.42.18-.83.5-1.11l7.5-6.57c.27-.23.61-.36.96-.36z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  filled?: boolean;
  badge?: number;
}

function NavItem({ icon: Icon, label, isActive, onClick, filled, badge }: NavItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="relative flex flex-1 flex-col items-center justify-start gap-2 px-1 pt-2 pb-2"
    >
      <div className="relative">
        <Icon
          className={`h-[26px] w-[26px] transition-all duration-200 ${
            isActive ? "text-primary" : "text-foreground"
          }`}
          strokeWidth={isActive ? 2.2 : 1.8}
          fill={filled && isActive ? "currentColor" : "none"}
        />
        {typeof badge === "number" && badge > 0 && (
          <span
            className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center tabular-nums leading-none ring-2 ring-background"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span
        className={`text-[10px] leading-none tracking-wide transition-colors duration-200 ${
          isActive ? "font-medium text-primary" : "font-normal text-foreground"
        }`}
      >
        {label}
      </span>
    </motion.button>
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
    // Sem polling: o badge é atualizado por eventos ('storage' e 'dub:cart-changed')
    // e ao voltar para o app.
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

/** Fixed 4-tab bottom navigation for the client app. */
export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = useCartBadge();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border/30 bg-background/95 backdrop-blur-md"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex h-16 w-full items-stretch justify-around">
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
    </nav>
  );
}
