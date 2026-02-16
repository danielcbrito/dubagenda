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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center justify-between"
    >
      {/* Greeting */}
      <div className="flex-1 min-w-0">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1"
        >
          {dayOfWeek}, {formattedDate}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg font-bold text-foreground tracking-tight leading-tight"
        >
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </motion.h1>
      </div>

      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.12, duration: 0.3 }}
        className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden flex-shrink-0 bg-primary"
        style={{
          boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)",
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)",
          }}
        />
        <span className="relative z-10 text-primary-foreground font-bold text-sm tabular-nums">
          {initials}
        </span>
      </motion.div>
    </motion.div>
  );
}
