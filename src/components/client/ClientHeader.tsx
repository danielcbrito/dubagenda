import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface ClientHeaderProps {
  profileName?: string;
  email?: string;
}

export function ClientHeader({ profileName, email }: ClientHeaderProps) {
  const firstName = profileName ? String(profileName).split(" ")[0] : null;
  const initials = firstName ? firstName.charAt(0).toUpperCase() : "?";
  const today = new Date();
  const dayOfWeek = format(today, "EEEE", { locale: ptBR });
  const formattedDate = format(today, "dd 'de' MMMM", { locale: ptBR });

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex items-center justify-between"
    >
      {/* Greeting */}
      <div className="flex-1 min-w-0">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-0.5"
        >
          {dayOfWeek}, {formattedDate}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="text-base font-bold text-foreground font-display tracking-tight leading-tight"
        >
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </motion.h1>
      </div>

      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.25 }}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-primary"
        style={{
          boxShadow: "0 3px 12px hsl(var(--primary) / 0.25)",
        }}
      >
        <span className="text-primary-foreground font-bold text-xs tabular-nums">
          {initials}
        </span>
      </motion.div>
    </motion.div>
  );
}
