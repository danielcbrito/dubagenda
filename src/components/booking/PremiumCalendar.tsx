import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isBefore, startOfDay, isSameMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PremiumCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date) => void;
  disabledDates?: Date[];
  closedDates?: Date[];
  closedWeekdays?: number[];
  minDate?: Date;
  onMonthChange?: (monthStart: Date, monthEnd: Date) => void;
  loading?: boolean;
}

export function PremiumCalendar({ selectedDate, onSelectDate, disabledDates = [], closedDates = [], closedWeekdays = [], minDate, onMonthChange, loading = false }: PremiumCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate || new Date()));
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(startOfMonth(currentMonth), endOfMonth(currentMonth));
    }
  }, [currentMonth, onMonthChange]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const isDateClosed = useCallback((date: Date) => {
    return closedDates.some(d => isSameDay(d, date));
  }, [closedDates]);

  const isDateDisabled = useCallback((date: Date) => {
    if (!isSameMonth(date, currentMonth)) return true;
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    if (minDate && isBefore(date, startOfDay(minDate))) return true;
    if (closedWeekdays.includes(date.getDay())) return true;
    if (isDateClosed(date)) return true;
    return disabledDates.some(d => isSameDay(d, date));
  }, [currentMonth, disabledDates, closedDates, closedWeekdays, minDate, isDateClosed]);

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const canGoPrev = !isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()));

  const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-border/30"
      style={{
        background: "hsl(var(--card))",
        boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {/* Month header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
            "active:scale-90",
            canGoPrev
              ? "text-foreground hover:bg-secondary/60"
              : "opacity-15 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          <motion.h2
            key={currentMonth.toISOString()}
            initial={{ opacity: 0, y: direction > 0 ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction > 0 ? -10 : 10 }}
            transition={{ duration: 0.2 }}
            className="text-[15px] font-bold text-foreground capitalize tracking-wide"
          >
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </motion.h2>
        </AnimatePresence>

        <button
          onClick={handleNextMonth}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
            "text-foreground hover:bg-secondary/60",
            "active:scale-90"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border/20" />

      {/* Weekday labels */}
      <div className="grid grid-cols-7 px-4 pt-4 pb-2">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-[0.15em]">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentMonth.toISOString()}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
          animate={{ opacity: loading ? 0.4 : 1, x: 0 }}
          exit={{ opacity: 0, x: direction < 0 ? 30 : -30 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn("grid grid-cols-7 gap-y-1 px-4 pb-5", loading && "pointer-events-none")}
        >
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const disabled = isDateDisabled(day);
            const isCurrentDay = isToday(day);

            if (!isCurrentMonth) {
              return <div key={day.toISOString()} className="aspect-square" />;
            }

            return (
              <motion.button
                key={day.toISOString()}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.005, duration: 0.15 }}
                onClick={() => !disabled && onSelectDate(day)}
                disabled={disabled}
                whileTap={!disabled ? { scale: 0.88 } : undefined}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center relative mx-auto w-full transition-all duration-200",
                  disabled && "cursor-not-allowed",
                  isSelected && "ring-[2.5px] ring-primary scale-[1.08]",
                  !isSelected && !disabled && "hover:bg-secondary/50",
                )}
              >
                <span className={cn(
                  "text-[15px] tabular-nums leading-none",
                  isSelected && "font-extrabold text-primary",
                  isCurrentMonth && isCurrentDay && !isSelected && !disabled && "font-black text-[hsl(0,85%,50%)] text-[16px]",
                  isCurrentMonth && disabled && !isSelected && "text-muted-foreground/15 font-normal",
                  isCurrentMonth && !disabled && !isSelected && !isCurrentDay && "font-semibold text-foreground",
                )}>
                  {format(day, "d")}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
