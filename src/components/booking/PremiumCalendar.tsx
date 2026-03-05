import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isBefore, startOfDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PremiumCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date) => void;
  disabledDates?: Date[];
  closedDates?: Date[];
  minDate?: Date;
  onMonthChange?: (monthStart: Date, monthEnd: Date) => void;
}

const MONTH_LIST = Array.from({ length: 12 }, (_, i) => i);

export function PremiumCalendar({ selectedDate, onSelectDate, disabledDates = [], closedDates = [], minDate, onMonthChange }: PremiumCalendarProps) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate || now));
  const daysScrollRef = useRef<HTMLDivElement>(null);
  const monthScrollRef = useRef<HTMLDivElement>(null);
  const selectedDayRef = useRef<HTMLButtonElement>(null);

  // Notify parent of month change
  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(startOfMonth(currentMonth), endOfMonth(currentMonth));
    }
  }, [currentMonth, onMonthChange]);

  // Generate months for carousel (current year + next year)
  const months = useMemo(() => {
    const result: Date[] = [];
    const startYear = now.getFullYear();
    for (let y = startYear; y <= startYear + 1; y++) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, 1);
        // Only show current month onwards
        if (d >= startOfMonth(now)) {
          result.push(d);
        }
      }
    }
    return result;
  }, []);

  // Days in current month
  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  const isDateClosed = useCallback((date: Date) => {
    return closedDates.some(d => isSameDay(d, date));
  }, [closedDates]);

  const isDateDisabled = useCallback((date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    if (minDate && isBefore(date, startOfDay(minDate))) return true;
    if (isDateClosed(date)) return true;
    return disabledDates.some(d => isSameDay(d, date));
  }, [disabledDates, closedDates, minDate]);

  const handleMonthSelect = (month: Date) => {
    setCurrentMonth(month);
  };

  // Scroll to selected day when it changes
  useEffect(() => {
    if (selectedDayRef.current && daysScrollRef.current) {
      const container = daysScrollRef.current;
      const el = selectedDayRef.current;
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [selectedDate, currentMonth]);

  // Scroll to active month in carousel
  useEffect(() => {
    if (monthScrollRef.current) {
      const activeBtn = monthScrollRef.current.querySelector('[data-active="true"]');
      if (activeBtn) {
        const container = monthScrollRef.current;
        const el = activeBtn as HTMLElement;
        const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [currentMonth]);

  const weekDayShort = (date: Date) => format(date, "EEE", { locale: ptBR }).replace(".", "");

  return (
    <div className="w-full">
      {/* Month Carousel */}
      <div
        ref={monthScrollRef}
        className="flex gap-2 overflow-x-auto pb-3 px-1 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {months.map((month) => {
          const isActive = month.getFullYear() === currentMonth.getFullYear() && month.getMonth() === currentMonth.getMonth();
          return (
            <button
              key={month.toISOString()}
              data-active={isActive}
              onClick={() => handleMonthSelect(month)}
              style={{ scrollSnapAlign: "center" }}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-semibold capitalize transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-card text-muted-foreground hover:bg-secondary/50 border border-border/30"
              )}
            >
              {format(month, "MMM yyyy", { locale: ptBR })}
            </button>
          );
        })}
      </div>

      {/* Days horizontal scroll */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMonth.toISOString()}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <div
            ref={daysScrollRef}
            className="flex gap-2.5 overflow-x-auto py-3 px-1 scrollbar-hide overscroll-contain"
            style={{
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              paddingLeft: "calc(50% - 24px)",
              paddingRight: "calc(50% - 24px)",
            }}
          >
            {days.map((day, idx) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const disabled = isDateDisabled(day);
              const isCurrentDay = isToday(day);

              return (
                <motion.button
                  key={day.toISOString()}
                  ref={isSelected ? selectedDayRef : undefined}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.012, duration: 0.15 }}
                  onClick={() => !disabled && onSelectDate(day)}
                  disabled={disabled}
                  style={{ scrollSnapAlign: "center" }}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center gap-1 w-[48px] py-2.5 rounded-2xl transition-all duration-200",
                    disabled && "opacity-[0.15] cursor-not-allowed",
                    !disabled && !isSelected && "hover:bg-secondary/50",
                    isSelected && "bg-foreground scale-105 shadow-lg shadow-foreground/15",
                    !isSelected && isCurrentDay && !disabled && "ring-1 ring-primary/40",
                    !isSelected && !disabled && "bg-card border border-border/20"
                  )}
                >
                  <span className={cn(
                    "text-[9px] font-medium uppercase tracking-wider",
                    isSelected ? "text-background" : "text-muted-foreground/60"
                  )}>
                    {weekDayShort(day)}
                  </span>
                  <span className={cn(
                    "text-[17px] tabular-nums transition-all",
                    isSelected ? "font-bold text-background" : "font-bold text-foreground",
                  )}>
                    {format(day, "d")}
                  </span>
                  {/* Dot indicator for today */}
                  {isCurrentDay && !isSelected && !disabled && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
