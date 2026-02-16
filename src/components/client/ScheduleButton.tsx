import { Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface ScheduleButtonProps {
  onClick: () => void;
}

export function ScheduleButton({ onClick }: ScheduleButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.25 }}
    >
      <button
        onClick={onClick}
        className="relative w-full h-12 rounded-xl text-[13px] font-semibold tracking-wide overflow-hidden bg-primary/90 text-primary-foreground active:scale-[0.98] transition-transform"
        style={{
          boxShadow: "0 4px 14px -3px hsl(var(--primary) / 0.3)",
        }}
      >
        <div className="relative z-10 flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>Agendar Horário</span>
        </div>
      </button>
    </motion.div>
  );
}
