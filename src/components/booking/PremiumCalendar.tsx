import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";

interface PremiumCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date) => void;
  disabledDates?: Date[];
  closedDates?: Date[];
  minDate?: Date;
  onMonthChange?: (monthStart: Date, monthEnd: Date) => void;
}

/**
 * Calendário premium para agendamento.
 * - disabledDates: datas desabilitadas (genérico)
 * - closedDates: datas em que a barbearia está FECHADA (ficam transparentes e não clicáveis)
 */
export function PremiumCalendar({ selectedDate, onSelectDate, disabledDates = [], closedDates = [], minDate, onMonthChange }: PremiumCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  // Notificar mudança de mês para que o pai carregue os dias fechados
  useEffect(() => {
    if (onMonthChange) {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      onMonthChange(start, end);
    }
  }, [currentMonth, onMonthChange]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    const firstDayOfWeek = start.getDay();
    const paddingDays = Array(firstDayOfWeek).fill(null);
    
    return [...paddingDays, ...days];
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

  return (
    <div className="bg-card/30 border border-border/30 rounded-2xl p-4 backdrop-blur-xl">
      {/* Header do calendário */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-foreground/70" />
        </button>
        
        <h3 className="text-base font-bold text-foreground capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        
        <button 
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-foreground/70" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-muted-foreground/60 py-1.5">
            {day}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isClosed = isDateClosed(day);
          const isDisabled = isDateDisabled(day);
          const isCurrentDay = isToday(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={day.toISOString()}
              onClick={() => !isDisabled && onSelectDate(day)}
              disabled={isDisabled}
              className={cn(
                "aspect-square rounded-lg text-[13px] font-medium transition-all flex items-center justify-center",
                !isCurrentMonth && "opacity-30",
                isClosed && "opacity-20 cursor-not-allowed line-through text-muted-foreground",
                isDisabled && !isClosed && "opacity-30 cursor-not-allowed",
                !isDisabled && !isSelected && "hover:bg-secondary text-foreground",
                isCurrentDay && !isSelected && !isClosed && "ring-1 ring-primary/50",
                isSelected && "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 scale-105"
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
