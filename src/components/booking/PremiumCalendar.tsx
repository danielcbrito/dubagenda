import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore, startOfDay, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PremiumCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date) => void;
  disabledDates?: Date[];
  closedDates?: Date[];
  minDate?: Date;
  onMonthChange?: (monthStart: Date, monthEnd: Date) => void;
}

/**
 * Calendário premium para agendamento — design inspirado na agenda admin.
 * - disabledDates: datas desabilitadas (genérico)
 * - closedDates: datas em que a barbearia está FECHADA (ficam transparentes e não clicáveis)
 */
export function PremiumCalendar({ selectedDate, onSelectDate, disabledDates = [], closedDates = [], minDate, onMonthChange }: PremiumCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate || new Date()));
  const [direction, setDirection] = useState(0);

  // Notificar mudança de mês para que o pai carregue os dias fechados
  useEffect(() => {
    if (onMonthChange) {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      onMonthChange(start, end);
    }
  }, [currentMonth, onMonthChange]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const isDateClosed = (date: Date) => {
    return closedDates.some(d => isSameDay(d, date));
  };

  const isDateDisabled = (date: Date) => {
    if (!date) return true;
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    if (minDate && isBefore(date, startOfDay(minDate))) return true;
    if (isDateClosed(date)) return true;
    return disabledDates.some(d => isSameDay(d, date));
  };

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(startOfMonth(today));
    onSelectDate(today);
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 50 : -50,
      opacity: 0
    })
  };

  return (
    <div 
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card) / 0.95), hsl(var(--card) / 0.7))",
        border: "1px solid hsl(var(--border) / 0.3)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)"
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold tracking-wide text-foreground capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
          </div>
          <button
            onClick={goToToday}
            className="px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-300"
          >
            Hoje
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-all duration-300 group"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-all duration-300 group"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-4 py-2.5 border-b border-border/10">
        {weekDays.map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentMonth.toISOString()}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid grid-cols-7 gap-1 p-3"
        >
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isClosed = isDateClosed(day);
            const isDisabled = isDateDisabled(day);
            const isCurrentDay = isToday(day);

            return (
              <motion.button
                key={day.toISOString()}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.008, duration: 0.15 }}
                onClick={() => !isDisabled && onSelectDate(day)}
                disabled={isDisabled}
                className={cn(
                  "relative aspect-square rounded-xl transition-all duration-200",
                  "flex items-center justify-center",
                  !isCurrentMonth && "opacity-20",
                  isClosed && "opacity-15 cursor-not-allowed",
                  isDisabled && !isClosed && !isCurrentMonth && "opacity-25 cursor-not-allowed",
                  !isDisabled && !isSelected && "hover:bg-secondary/50",
                  isSelected && "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105",
                  isCurrentDay && !isSelected && !isClosed && "ring-1 ring-primary/50"
                )}
              >
                <span className={cn(
                  "text-[13px] font-medium",
                  isSelected && "font-semibold",
                  isClosed && "line-through",
                  !isCurrentMonth && "text-muted-foreground",
                  isCurrentMonth && !isSelected && !isDisabled && "text-foreground",
                  isCurrentMonth && isDisabled && !isClosed && "text-muted-foreground"
                )}>
                  {format(day, "d")}
                </span>

                {/* Today indicator ring */}
                {isCurrentDay && !isSelected && !isClosed && (
                  <div className="absolute inset-0 rounded-xl ring-1 ring-primary/30 pointer-events-none" />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
