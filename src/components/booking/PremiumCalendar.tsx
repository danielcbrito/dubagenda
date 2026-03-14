import { useEffect, useMemo, useCallback, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { startOfMonth, endOfMonth, isSameDay, isBefore, startOfDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PremiumCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date) => void;
  disabledDates?: Date[];
  closedDates?: Date[];
  minDate?: Date;
  onMonthChange?: (monthStart: Date, monthEnd: Date) => void;
  loading?: boolean;
}

export function PremiumCalendar({
  selectedDate,
  onSelectDate,
  disabledDates = [],
  closedDates = [],
  minDate,
  onMonthChange,
  loading = false,
}: PremiumCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfMonth(selectedDate || new Date())
  );

  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(startOfMonth(currentMonth), endOfMonth(currentMonth));
    }
  }, [currentMonth, onMonthChange]);

  const isDateDisabled = useCallback(
    (date: Date) => {
      const today = startOfDay(new Date());
      if (isBefore(date, today)) return true;
      if (minDate && isBefore(date, startOfDay(minDate))) return true;
      if (closedDates.some((d) => isSameDay(d, date))) return true;
      if (disabledDates.some((d) => isSameDay(d, date))) return true;
      return false;
    },
    [disabledDates, closedDates, minDate]
  );

  const handleMonthChange = useCallback(
    (month: Date) => {
      setCurrentMonth(month);
    },
    []
  );

  return (
    <div
      className={cn(
        "w-full rounded-2xl overflow-hidden border border-border/40",
        "bg-card shadow-soft transition-opacity duration-200",
        loading && "opacity-50 pointer-events-none"
      )}
    >
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => date && onSelectDate(date)}
        month={currentMonth}
        onMonthChange={handleMonthChange}
        disabled={isDateDisabled}
        locale={ptBR}
        captionLayout="dropdown"
        fromYear={new Date().getFullYear()}
        toYear={new Date().getFullYear() + 1}
        showOutsideDays={false}
        className={cn("p-4 pointer-events-auto w-full")}
        classNames={{
          months: "flex flex-col w-full",
          month: "space-y-3 w-full",
          caption: "flex justify-center items-center relative h-10",
          caption_label: "hidden",
          caption_dropdowns: "flex items-center gap-2",
          dropdown_month: "relative",
          dropdown_year: "relative",
          dropdown:
            "appearance-none bg-secondary text-foreground text-sm font-semibold rounded-lg px-3 py-1.5 border border-border/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
          nav: "flex items-center gap-1",
          nav_button: cn(
            "h-8 w-8 bg-secondary/60 hover:bg-secondary rounded-lg p-0 flex items-center justify-center",
            "text-foreground/70 hover:text-foreground transition-colors",
            "disabled:opacity-20 disabled:cursor-not-allowed"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell:
            "text-muted-foreground/50 rounded-md flex-1 font-semibold text-[10px] uppercase tracking-wider text-center py-2",
          row: "flex w-full mt-1",
          cell: cn(
            "flex-1 text-center text-sm p-0.5 relative",
            "focus-within:relative focus-within:z-20"
          ),
          day: cn(
            "h-10 w-10 mx-auto p-0 font-medium rounded-xl",
            "text-foreground text-[14px] tabular-nums",
            "hover:bg-secondary/70 transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            "flex items-center justify-center"
          ),
          day_selected: cn(
            "!bg-primary !text-primary-foreground !font-bold",
            "ring-2 ring-primary/30 ring-offset-2 ring-offset-card",
            "hover:!bg-primary hover:!text-primary-foreground",
            "scale-105"
          ),
          day_today: cn(
            "font-bold text-primary",
            "ring-1 ring-primary/30"
          ),
          day_outside: "text-muted-foreground/20 opacity-50",
          day_disabled: "text-muted-foreground/20 opacity-40 cursor-not-allowed hover:bg-transparent",
          day_range_middle: "",
          day_hidden: "invisible",
        }}
      />
    </div>
  );
}
