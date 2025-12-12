import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimeSlot {
  time: string;
  available: boolean;
  blockedReason?: string;
}

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedTime: string;
  onSelect: (time: string, slot: TimeSlot) => void;
  loading?: boolean;
}

export const TimeSlotGrid = ({ slots, selectedTime, onSelect, loading }: TimeSlotGridProps) => {
  const availableSlots = slots.filter(s => s.available);
  const morningSlots = slots.filter(s => parseInt(s.time) < 12);
  const afternoonSlots = slots.filter(s => parseInt(s.time) >= 12 && parseInt(s.time) < 18);
  const eveningSlots = slots.filter(s => parseInt(s.time) >= 18);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-[20px] p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(197, 164, 109, 0.1)',
        }}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-3 bg-white/10 rounded w-3/4 mx-auto"></div>
          <div className="h-3 bg-white/10 rounded w-1/2 mx-auto"></div>
          <div className="flex justify-center gap-2 mt-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-16 h-10 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
        <p className="text-sm mt-6" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
          Carregando horários...
        </p>
      </motion.div>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[20px] p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 30, 37, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139, 30, 37, 0.2)',
        }}
      >
        <Clock className="w-12 h-12 mx-auto mb-4 text-[#8B1E25]" />
        <p className="font-medium mb-2" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          Agenda cheia neste dia
        </p>
        <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
          Por favor, selecione outra data
        </p>
      </motion.div>
    );
  }

  const renderSlotGroup = (groupSlots: TimeSlot[], title: string, icon: string) => {
    if (groupSlots.length === 0) return null;
    
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            {title}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {groupSlots.map((slot, index) => (
            <TimeSlotButton
              key={slot.time}
              slot={slot}
              isSelected={selectedTime === slot.time}
              onClick={() => onSelect(slot.time, slot)}
              index={index}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderSlotGroup(morningSlots, "Manhã", "☀️")}
      {renderSlotGroup(afternoonSlots, "Tarde", "🌤️")}
      {renderSlotGroup(eveningSlots, "Noite", "🌙")}
    </div>
  );
};

interface TimeSlotButtonProps {
  slot: TimeSlot;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}

const TimeSlotButton = ({ slot, isSelected, onClick, index }: TimeSlotButtonProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.3,
        delay: index * 0.02,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={slot.available ? { scale: 1.05, y: -2 } : {}}
      whileTap={slot.available ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={!slot.available}
      className={cn(
        "relative h-12 rounded-xl font-medium text-sm transition-all duration-300 overflow-hidden",
        !slot.available && "opacity-30 cursor-not-allowed"
      )}
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, #8B1E25 0%, #C5A46D 100%)'
          : slot.available
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)'
            : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${
          isSelected 
            ? 'rgba(197, 164, 109, 0.5)' 
            : slot.available 
              ? 'rgba(255, 255, 255, 0.08)' 
              : 'rgba(255, 255, 255, 0.03)'
        }`,
        boxShadow: isSelected
          ? '0 4px 20px rgba(139, 30, 37, 0.4), 0 0 40px rgba(197, 164, 109, 0.2)'
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        color: isSelected ? '#ffffff' : slot.available ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)'
      }}
    >
      {/* Top shine for selected */}
      {isSelected && (
        <div 
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.4) 50%, transparent 90%)'
          }}
        />
      )}
      
      <span className="relative z-10">{slot.time}</span>
      
      {/* Selection glow */}
      {isSelected && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)'
          }}
        />
      )}
    </motion.button>
  );
};
