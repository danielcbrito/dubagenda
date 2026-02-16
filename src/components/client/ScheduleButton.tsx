import { Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface ScheduleButtonProps {
  onClick: () => void;
}

export function ScheduleButton({ onClick }: ScheduleButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.35 }}
    >
      <button
        onClick={onClick}
        className="relative w-full h-14 rounded-2xl text-base font-bold tracking-wide overflow-hidden bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
        style={{
          boxShadow: "0 8px 28px -4px hsl(var(--primary) / 0.45), 0 4px 12px rgba(0, 0, 0, 0.2)",
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 flex items-center justify-center gap-3">
          <Calendar className="w-5 h-5" />
          <span>Agendar Horário</span>
        </div>
      </button>
    </motion.div>
  );
}
