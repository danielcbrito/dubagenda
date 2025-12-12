import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PremiumCalendarProps {
  selectedDate: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}

export const PremiumCalendar = ({ selectedDate, onSelect }: PremiumCalendarProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative rounded-[24px] overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(197, 164, 109, 0.15)',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      {/* Top shine line */}
      <div 
        className="absolute top-0 left-0 right-0 h-px z-10"
        style={{
          background: 'linear-gradient(90deg, transparent 10%, rgba(197, 164, 109, 0.4) 50%, transparent 90%)'
        }}
      />
      
      {/* Metallic header background */}
      <div 
        className="absolute top-0 left-0 right-0 h-16"
        style={{
          background: 'linear-gradient(180deg, rgba(197, 164, 109, 0.08) 0%, transparent 100%)'
        }}
      />
      
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        locale={ptBR}
        disabled={(date) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const compareDate = new Date(date);
          compareDate.setHours(0, 0, 0, 0);
          return compareDate < today || date.getDay() === 0;
        }}
        className="p-5 pointer-events-auto"
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-base font-semibold text-[#C5A46D]",
          nav: "space-x-1 flex items-center",
          nav_button: "h-9 w-9 rounded-xl bg-transparent hover:bg-white/5 border border-transparent hover:border-[#C5A46D]/30 transition-all duration-300",
          nav_button_previous: "absolute left-2",
          nav_button_next: "absolute right-2",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: "text-[#C5A46D]/60 rounded-md w-10 font-medium text-[0.75rem] uppercase tracking-wider",
          row: "flex w-full mt-2",
          cell: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
          day: "h-10 w-10 p-0 font-medium rounded-xl transition-all duration-300 hover:bg-[#C5A46D]/10 hover:text-white aria-selected:opacity-100",
          day_range_end: "day-range-end",
          day_selected: "bg-gradient-to-br from-[#8B1E25] to-[#C5A46D] text-white hover:bg-gradient-to-br hover:from-[#8B1E25] hover:to-[#C5A46D] focus:bg-gradient-to-br focus:from-[#8B1E25] focus:to-[#C5A46D] shadow-lg shadow-[#8B1E25]/30",
          day_today: "text-[#C5A46D] font-bold ring-1 ring-[#C5A46D]/40",
          day_outside: "opacity-30 aria-selected:bg-accent/50 aria-selected:opacity-30",
          day_disabled: "text-white/20 opacity-30 cursor-not-allowed hover:bg-transparent",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
        }}
        components={{
          IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4 text-[#C5A46D]" />,
          IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4 text-[#C5A46D]" />,
        }}
      />
      
      {/* Bottom decorative line */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 20%, rgba(139, 30, 37, 0.3) 50%, transparent 80%)'
        }}
      />
    </motion.div>
  );
};
