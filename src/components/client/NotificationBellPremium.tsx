import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NotificationBellPremiumProps {
  userId: string;
}

export function NotificationBellPremium({ userId }: NotificationBellPremiumProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();

    const channel = supabase
      .channel("notif-bell-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from("notificacoes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lida", false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch {
      // silent
    }
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => setSheetOpen(true)}
        className={cn(
          "relative w-8 h-8 rounded-full flex items-center justify-center",
          "border border-border bg-card",
          "transition-colors active:bg-muted"
        )}
      >
        <Bell className="w-[15px] h-[15px] text-muted-foreground" strokeWidth={1.8} />
        
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary flex items-center justify-center"
            >
              <span className="text-[9px] font-bold text-primary-foreground tabular-nums leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <NotificationsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={userId}
      />
    </>
  );
}
