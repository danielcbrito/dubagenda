import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { NotificationBellPremium } from "./NotificationBellPremium";

interface ClientHeaderProps {
  profileName?: string;
  email?: string;
  userId?: string;
  realtimeConnected?: boolean;
}

export function ClientHeader({ profileName, email, userId, realtimeConnected = true }: ClientHeaderProps) {
  const firstName = profileName ? String(profileName).split(" ")[0] : null;
  const initials = firstName ? firstName.charAt(0).toUpperCase() : "?";
  const today = new Date();
  const dayOfWeek = format(today, "EEEE", { locale: ptBR });
  const formattedDate = format(today, "dd 'de' MMMM", { locale: ptBR });

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center justify-between"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-[0.18em]">
            {dayOfWeek} · {formattedDate}
          </p>
          <AnimatePresence>
            {!realtimeConnected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                title="Atualizações em tempo real temporariamente indisponíveis"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-destructive/10 border border-destructive/20"
              >
                <WifiOff className="w-2.5 h-2.5 text-destructive/70" strokeWidth={2} />
                <span className="text-[8px] font-semibold text-destructive/70 uppercase tracking-wider">
                  Offline
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <h1 className="text-[15px] font-semibold text-foreground font-display tracking-tight leading-snug">
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notification Bell */}
        {userId && (
          <NotificationBellPremium userId={userId} />
        )}

        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.2 }}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-border"
          style={{
            background: "hsl(var(--card))",
          }}
        >
          <span className="text-foreground/80 font-semibold text-[11px]">
            {initials}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}