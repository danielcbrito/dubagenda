import { Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface ScheduleButtonProps {
  onClick: () => void;
}

export function ScheduleButton({ onClick }: ScheduleButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
    >
      <button
        onClick={onClick}
        className="relative w-full h-12 rounded-xl text-sm font-semibold tracking-wide overflow-hidden bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
        style={{
          boxShadow: "0 6px 20px -4px hsl(var(--primary) / 0.4)",
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 flex items-center justify-center gap-2.5">
          <Calendar className="w-4 h-4" />
          <span>Agendar Horário</span>
        </div>
      </button>
    </motion.div>
  );
}
