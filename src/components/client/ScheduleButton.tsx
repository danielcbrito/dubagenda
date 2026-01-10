import { Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ScheduleButtonProps {
  onClick: () => void;
}

export function ScheduleButton({ onClick }: ScheduleButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Button
        onClick={onClick}
        className="relative w-full h-14 rounded-2xl text-base font-bold tracking-wide overflow-hidden group"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0, 70%, 45%) 100%)",
          boxShadow: "0 8px 24px -4px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        {/* Animated shine effect */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
          }}
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
        />

        {/* Inner highlight */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 flex items-center justify-center gap-3">
          <motion.div
            whileHover={{ rotate: 12 }}
            transition={{ duration: 0.2 }}
          >
            <Calendar className="w-5 h-5" />
          </motion.div>
          <span>Agendar Horário</span>
        </div>
      </Button>
    </motion.div>
  );
}
