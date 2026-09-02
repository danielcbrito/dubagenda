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

export function ClientHeader({ profileName, userId }: ClientHeaderProps) {
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
        <p className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-[0.18em] mb-0.5 truncate">
          {dayOfWeek} · {formattedDate}
        </p>
        <h1 className="text-[15px] font-semibold text-foreground font-display tracking-tight leading-snug truncate">
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {userId && (
          <NotificationBellPremium userId={userId} />
        )}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.2 }}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-border"
          style={{ background: "hsl(var(--card))" }}
        >
          <span className="text-foreground/80 font-semibold text-[11px]">
            {initials}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
