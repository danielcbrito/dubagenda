import { Crown, Home, ShoppingBag, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  badge?: number;
}

/** Ícone contornado quando inativo, preenchido em vermelho quando ativo (estilo iFood). */
function NavItem({ icon: Icon, label, isActive, onClick, badge }: NavItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 px-2 py-1 ${
        isActive ? "text-primary" : "text-muted-foreground/70"
      }`}
    >
      <div className="relative">
        <Icon
          className="h-[22px] w-[22px] transition-all duration-200"
          strokeWidth={isActive ? 2 : 1.8}
          fill={isActive ? "currentColor" : "none"}
        />
        {typeof badge === "number" && badge > 0 && (
          <span className="absolute -top-2 -right-2.5 min-w-[19px] h-[19px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center tabular-nums leading-none ring-2 ring-background">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span
        className={`text-[12px] leading-none tracking-wide transition-colors duration-200 ${
          isActive ? "font-medium" : "font-normal"
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      userId = s?.user?.id ?? null;
      recount();
    });

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("dub_cart_")) recount();
    };
    const onCustom = () => recount();

    window.addEventListener("storage", onStorage);
    window.addEventListener("dub:cart-changed", onCustom);
    const onVisible = () => {
      if (document.visibilityState === "visible") recount();
    };
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
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-foreground/15 bg-background"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex w-full items-start justify-around px-2 pt-2 pb-3">
        <NavItem
          icon={Home}
          label="Início"
          isActive={isActive("/cliente")}
          onClick={() => navigate("/cliente")}
        />
        <NavItem
          icon={ShoppingBag}
          label="Loja"
          badge={cartCount}
          isActive={isActive("/cliente/loja")}
          onClick={() => navigate("/cliente/loja")}
        />
        <NavItem
          icon={Crown}
          label="Plano"
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
