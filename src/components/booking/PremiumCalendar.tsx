import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isBefore, startOfDay, isSameMonth, startOfWeek, endOfWeek } from "date-fns";
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

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className="w-full bg-white border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-3xl p-5 relative overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between mb-6 px-2">
        <AnimatePresence mode="wait">
          <motion.h2
            key={currentMonth.toISOString()}
            initial={{ opacity: 0, y: direction > 0 ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction > 0 ? -10 : 10 }}
            transition={{ duration: 0.2 }}
            className="text-[17px] font-medium text-foreground tracking-tight capitalize"
          >
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </motion.h2>
        </AnimatePresence>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
              canGoPrev ? "text-foreground hover:bg-neutral-200 active:scale-95" : "opacity-30 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center text-foreground hover:bg-neutral-200 active:scale-95 transition-all duration-200"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-4">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-[13px] font-medium text-foreground">
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
          className={cn("grid grid-cols-7 gap-y-3 gap-x-1", loading && "pointer-events-none")}
        >
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const disabled = isDateDisabled(day);

            if (!isCurrentMonth) {
              return <div key={day.toISOString()} className="aspect-square" />;
            }

            const isRedDot = day.getDate() % 4 === 0;

            return (
              <div key={day.toISOString()} className="flex flex-col items-center">
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.005, duration: 0.15 }}
                  onClick={() => !disabled && onSelectDate(day)}
                  disabled={disabled}
                  whileTap={!disabled ? { scale: 0.9 } : undefined}
                  className={cn(
                    "w-[42px] h-[42px] rounded-full flex items-center justify-center transition-all duration-200",
                    disabled
                      ? "cursor-not-allowed bg-transparent text-neutral-300 shadow-none pointer-events-none select-none"
                      : isSelected
                        ? "cursor-pointer bg-neutral-900 text-white shadow-md font-medium"
                        : "cursor-pointer bg-white text-neutral-900 hover:bg-neutral-100 shadow-sm font-medium"
                  )}
                >
                  <span
                    className={cn(
                      "text-[15px]",
                      disabled ? "text-neutral-300 font-normal" : "text-neutral-900 font-medium",
                      isSelected && "text-white font-medium"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </motion.button>

                {/* Dots indicator */}
                {!disabled && (
                  <div className={cn(
                    "w-1 h-1 rounded-full mt-1.5",
                    isRedDot ? "bg-red-500" : "bg-emerald-500",
                    isSelected && "opacity-0"
                  )} />
                )}
                {disabled && (
                  <div className="w-1 h-1 mt-1.5 opacity-0" />
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
