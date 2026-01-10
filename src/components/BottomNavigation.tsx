import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Bell, 
  CreditCard, 
  HeadphonesIcon, 
  Menu, 
  ShoppingBag, 
  User, 
  Wallet 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { BottomNavItem } from "@/components/client/BottomNavItem";
import { StoreComingSoonDialog } from "@/components/client/StoreComingSoonDialog";

interface BottomNavigationProps {
  onProfileClick: () => void;
  onPlansClick: () => void;
  onPointsClick: () => void;
  onWalletClick: () => void;
  onHistoryClick: () => void;
  userId?: string;
  onMenuClick?: () => void;
}

export function BottomNavigation({
  onProfileClick,
  onPlansClick,
  onPointsClick: _onPointsClick,
  onWalletClick,
  onHistoryClick: _onHistoryClick,
  userId,
  onMenuClick,
}: BottomNavigationProps) {
  const navigate = useNavigate();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleSupport = useCallback(() => {
    navigate("/suporte");
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    const loadUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("notificacoes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("lida", false);

        if (error) throw error;
        if (mounted) setUnreadCount(count || 0);
      } catch (error) {
        console.error("Erro ao carregar contagem de notificações:", error);
      }
    };

    void loadUnreadCount();

    const channel = supabase
      .channel("notification-count-bottom-nav")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Order: Avisos | Perfil | Carteira | Suporte (center) | Planos | Loja | Menu
  const navItems = useMemo(() => {
    const items = [];

    // Avisos (notifications)
    if (userId) {
      items.push({
        key: "notifications",
        icon: Bell,
        label: "Avisos",
        onClick: () => setNotificationsOpen(true),
        badgeCount: unreadCount,
      });
    }

    // Perfil
    items.push({
      key: "profile",
      icon: User,
      label: "Perfil",
      onClick: onProfileClick,
    });

    // Carteira
    items.push({
      key: "wallet",
      icon: Wallet,
      label: "Carteira",
      onClick: onWalletClick,
    });

    // Suporte (center)
    items.push({
      key: "support",
      icon: HeadphonesIcon,
      label: "Suporte",
      onClick: handleSupport,
      isCenter: true,
    });

    // Planos
    items.push({
      key: "plans",
      icon: CreditCard,
      label: "Planos",
      onClick: onPlansClick,
    });

    // Loja (new)
    items.push({
      key: "store",
      icon: ShoppingBag,
      label: "Loja",
      onClick: () => setStoreDialogOpen(true),
    });

    // Menu
    if (onMenuClick) {
      items.push({
        key: "menu",
        icon: Menu,
        label: "Menu",
        onClick: onMenuClick,
      });
    }

    return items;
  }, [handleSupport, onMenuClick, onPlansClick, onProfileClick, onWalletClick, unreadCount, userId]);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Container with white background and shadow */}
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative"
          style={{
            background: "hsl(var(--card))",
            borderTop: "1px solid hsl(var(--border))",
            boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.15)",
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent 10%, hsl(var(--primary) / 0.3) 50%, transparent 90%)",
            }}
          />

          <div className="max-w-lg mx-auto px-2">
            <div className="flex items-end justify-between py-2 pb-safe">
              {navItems.map((item) => (
                <BottomNavItem
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  onClick={item.onClick}
                  isCenter={item.isCenter}
                  badgeCount={item.badgeCount}
                />
              ))}
            </div>
          </div>

          {/* Bottom safe area fill */}
          <div 
            className="h-safe" 
            style={{ background: "hsl(var(--card))" }} 
          />
        </motion.div>
      </div>

      {/* Notifications Sheet */}
      {userId && (
        <NotificationsSheet 
          open={notificationsOpen} 
          onOpenChange={setNotificationsOpen} 
          userId={userId} 
        />
      )}

      {/* Store Coming Soon Dialog */}
      <StoreComingSoonDialog 
        open={storeDialogOpen} 
        onOpenChange={setStoreDialogOpen} 
      />
    </>
  );
}
