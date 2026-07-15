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

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center justify-between py-2"
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-[20px] font-bold text-foreground font-display tracking-tight leading-none">
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
          className="w-9 h-9 rounded-full flex items-center justify-center border border-border bg-card shadow-sm"
        >
          <span className="text-foreground font-bold text-[13px]">
            {initials}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
