import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CompactWeekSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onTodayClick: () => void;
}

export function CompactWeekSelector({ 
  selectedDate, 
  onDateChange,
  onTodayClick 
}: CompactWeekSelectorProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const handlePrevWeek = () => {
    onDateChange(subWeeks(selectedDate, 1));
  };

  const handleNextWeek = () => {
    onDateChange(addWeeks(selectedDate, 1));
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    return weekStart.getTime() === currentWeekStart.getTime();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 px-5 py-3 rounded-xl"
      style={{
        background: "linear-gradient(135deg, rgba(24, 24, 29, 0.95), rgba(14, 14, 17, 0.98))",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Week Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
          <CalendarDays className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {format(weekStart, "dd", { locale: ptBR })} - {format(weekEnd, "dd 'de' MMMM", { locale: ptBR })}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(weekStart, "yyyy")}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        {!isCurrentWeek() && (
          <button
            onClick={onTodayClick}
            className="px-3 py-1.5 text-xs font-medium tracking-wide rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-300"
          >
            Hoje
          </button>
        )}
        
        <div className="flex items-center rounded-lg bg-white/5">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-l-lg hover:bg-white/10 transition-all duration-300 group"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button
            onClick={handleNextWeek}
            className="p-2 rounded-r-lg hover:bg-white/10 transition-all duration-300 group"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
