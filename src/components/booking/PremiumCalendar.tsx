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
  minDate?: Date;
  onMonthChange?: (monthStart: Date, monthEnd: Date) => void;
}

export function PremiumCalendar({ selectedDate, onSelectDate, disabledDates = [], closedDates = [], minDate, onMonthChange }: PremiumCalendarProps) {
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
    if (isDateClosed(date)) return true;
    return disabledDates.some(d => isSameDay(d, date));
  }, [currentMonth, disabledDates, closedDates, minDate]);

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const canGoPrev = !isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()));

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className="w-full">
      {/* Month header */}
      <div className="flex items-center justify-between px-2 mb-5">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
            "active:scale-90",
            canGoPrev
              ? "bg-card border border-border/30 text-foreground hover:bg-secondary/50"
              : "opacity-20 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <motion.h2
          key={currentMonth.toISOString()}
          initial={{ opacity: 0, y: direction > 0 ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-base font-bold text-foreground capitalize tracking-wide"
        >
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </motion.h2>

        <button
          onClick={handleNextMonth}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
            "bg-card border border-border/30 text-foreground hover:bg-secondary/50",
            "active:scale-90"
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-2 px-1">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentMonth.toISOString()}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction < 0 ? 40 : -40 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="grid grid-cols-7 gap-y-1.5 gap-x-1 px-1"
        >
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const disabled = isDateDisabled(day);
            const isCurrentDay = isToday(day);

            if (!isCurrentMonth) {
              return (
                <div key={day.toISOString()} className="aspect-square" />
              );
            }

            return (
              <motion.button
                key={day.toISOString()}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.006, duration: 0.18 }}
                onClick={() => !disabled && onSelectDate(day)}
                disabled={disabled}
                className={cn(
                  "aspect-square rounded-2xl flex items-center justify-center relative transition-all duration-200",
                  "active:scale-[0.92]",
                  disabled && "cursor-not-allowed",
                  // Selected state - primary color with glow
                  isSelected && "bg-primary shadow-[0_4px_20px_rgba(var(--primary-rgb,220,38,38),0.35)] scale-[1.08]",
                  // Today indicator
                  !isSelected && isCurrentDay && !disabled && "ring-[1.5px] ring-primary/50",
                  // Normal available
                  !isSelected && !disabled && "hover:bg-secondary/60",
                )}
              >
                <span className={cn(
                  "text-[14px] tabular-nums relative z-10",
                  isSelected && "font-extrabold text-primary-foreground",
                  !isCurrentMonth && "text-transparent",
                  isCurrentMonth && disabled && !isSelected && "text-muted-foreground/15 font-normal",
                  isCurrentMonth && !disabled && !isSelected && "font-semibold text-foreground",
                )}>
                  {format(day, "d")}
                </span>

                {/* Today dot */}
                {isCurrentDay && !isSelected && !disabled && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
