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
        className="w-full h-12 rounded-full text-[15px] font-medium tracking-tight bg-neutral-900 text-white hover:bg-neutral-800 active:scale-[0.98] transition-all"
      >
        <div className="flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4 opacity-90" />
          <span>Agendar Horário</span>
        </div>
      </button>
    </motion.div>
  );
}
