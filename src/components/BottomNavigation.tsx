import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Gift, HeadphonesIcon, Menu, Trophy, User, Wallet, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsSheet } from "@/components/NotificationsSheet";

interface BottomNavigationProps {
  onProfileClick: () => void;
  onPlansClick: () => void;
  onPointsClick: () => void;
  onWalletClick: () => void;
  onHistoryClick: () => void;
  userId?: string;
  onMenuClick?: () => void;
}

interface NavItem {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  isCenter?: boolean;
  badgeCount?: number;
}

export function BottomNavigation({
  onProfileClick,
  onPlansClick,
  onPointsClick,
  onWalletClick,
  onHistoryClick: _onHistoryClick,
  userId,
  onMenuClick,
}: BottomNavigationProps) {
  const navigate = useNavigate();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
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


  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];

    if (userId) {
      items.push({
        key: "notifications",
        icon: Bell,
        label: "Avisos",
        onClick: () => setNotificationsOpen(true),
        badgeCount: unreadCount,
      });
    }

    items.push(
      {
        key: "profile",
        icon: User,
        label: "Perfil",
        onClick: onProfileClick,
      },
      {
        key: "wallet",
        icon: Wallet,
        label: "Carteira",
        onClick: onWalletClick,
      },
      {
        key: "support",
        icon: HeadphonesIcon,
        label: "Suporte",
        onClick: handleSupport,
        isCenter: true,
      },
      {
        key: "plans",
        icon: Gift,
        label: "Planos",
        onClick: onPlansClick,
      },
      {
        key: "points",
        icon: Trophy,
        label: "Pontos",
        onClick: onPointsClick,
      }
    );

    if (onMenuClick) {
      items.push({
        key: "menu",
        icon: Menu,
        label: "Menu",
        onClick: onMenuClick,
      });
    }

    return items;
  }, [handleSupport, onMenuClick, onPlansClick, onPointsClick, onProfileClick, onWalletClick, unreadCount, userId]);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
        {/* Premium glassmorphism container */}
        <div
          className="relative"
          style={{
            background: "linear-gradient(180deg, rgba(10, 10, 10, 0.6) 0%, rgba(15, 15, 15, 0.95) 100%)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {/* Top border glow */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(217, 65, 65, 0.3) 20%, rgba(217, 65, 65, 0.5) 50%, rgba(217, 65, 65, 0.3) 80%, transparent 100%)",
            }}
          />

          {/* Subtle inner glow */}
          <div
            className="absolute inset-x-0 top-0 h-12 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)",
            }}
          />

          <div className="max-w-lg mx-auto px-3">
            <div className="flex items-end justify-between py-2 relative">
              {navItems.map((item) => (
                <motion.button
                  key={item.key}
                  onClick={item.onClick}
                  whileTap={{ scale: 0.92 }}
                  className={cn(
                    "flex flex-col items-center justify-center transition-all duration-300 group relative",
                    item.isCenter ? "relative -mt-7 z-10" : "flex-1 py-2"
                  )}
                >
                  {item.isCenter ? (
                    // Centro destacado - Suporte Premium
                    <div className="relative flex flex-col items-center">
                      {/* Outer glow ring - pulsing */}
                      <div
                        className="absolute -inset-2 rounded-full animate-pulse opacity-60"
                        style={{
                          background: "radial-gradient(circle, rgba(217, 65, 65, 0.4) 0%, transparent 70%)",
                        }}
                      />

                      {/* Secondary glow */}
                      <div
                        className="absolute -inset-1 rounded-full blur-md"
                        style={{
                          background: "linear-gradient(135deg, rgba(217, 65, 65, 0.5) 0%, rgba(180, 50, 50, 0.3) 100%)",
                        }}
                      />

                      {/* Main button */}
                      <motion.div
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300"
                        style={{
                          background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0, 65%, 40%) 100%)",
                          boxShadow:
                            "0 8px 32px rgba(217, 65, 65, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
                        }}
                      >
                        {/* Inner highlight */}
                        <div
                          className="absolute inset-0.5 rounded-full opacity-20"
                          style={{
                            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%)",
                          }}
                        />
                        <item.icon className="w-6 h-6 text-white relative z-10" strokeWidth={2.2} />
                      </motion.div>

                      {/* Label */}
                      <span className="text-[10px] font-semibold mt-2 tracking-wide" style={{ color: "hsl(var(--primary))" }}>
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    // Items normais - Premium style
                    <div className="flex flex-col items-center gap-1 relative">
                      {/* Hover background */}
                      <div
                        className="absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: "radial-gradient(circle, rgba(217, 65, 65, 0.08) 0%, transparent 70%)",
                        }}
                      />

                      {/* Icon container */}
                      <div
                        className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                        style={{
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                        }}
                      >
                        {/* Hover glow */}
                        <div
                          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{
                            background: "linear-gradient(135deg, rgba(217, 65, 65, 0.1) 0%, transparent 100%)",
                            border: "1px solid rgba(217, 65, 65, 0.2)",
                          }}
                        />

                        <item.icon
                          className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300 relative z-10"
                          strokeWidth={1.8}
                        />

                        {typeof item.badgeCount === "number" && item.badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center z-20">
                            {item.badgeCount > 9 ? "9+" : item.badgeCount}
                          </span>
                        )}
                      </div>

                      {/* Label */}
                      <span className="text-[8px] font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-300 tracking-wide">
                        {item.label}
                      </span>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Bottom safe area fill */}
          <div className="h-safe" style={{ background: "rgba(15, 15, 15, 0.95)" }} />
        </div>
      </div>

      {userId && (
        <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} userId={userId} />
      )}
    </>
  );
}

