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
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center justify-between"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-[0.18em] mb-0.5">
          {dayOfWeek} · {formattedDate}
        </p>
        <h1 className="text-[15px] font-semibold text-foreground/90 font-display tracking-tight leading-snug">
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </h1>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.08, duration: 0.2 }}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-border/60"
        style={{
          background: "hsl(var(--card))",
        }}
      >
        <span className="text-foreground/70 font-semibold text-[11px]">
          {initials}
        </span>
      </motion.div>
    </motion.div>
  );
}
