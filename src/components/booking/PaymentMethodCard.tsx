import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, Smartphone, CreditCard, Wallet } from "lucide-react";

interface PaymentMethodCardProps {
  method: 'pix' | 'card' | 'cash';
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

const methodIcons = {
  pix: Smartphone,
  card: CreditCard,
  cash: Wallet,
};

export const PaymentMethodCard = ({ 
  method, 
  title, 
  description, 
  isSelected, 
  onSelect,
  index 
}: PaymentMethodCardProps) => {
  const Icon = methodIcons[method];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        "relative cursor-pointer rounded-[18px] overflow-hidden transition-all duration-400"
      )}
      style={{
        background: isSelected 
          ? 'linear-gradient(135deg, rgba(139, 30, 37, 0.15) 0%, rgba(197, 164, 109, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isSelected ? 'rgba(197, 164, 109, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
        boxShadow: isSelected 
          ? '0 8px 32px rgba(139, 30, 37, 0.2), 0 0 60px rgba(197, 164, 109, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Top shine line */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: isSelected 
            ? 'linear-gradient(90deg, transparent 10%, rgba(197, 164, 109, 0.5) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.1) 50%, transparent 90%)'
        }}
      />
      
      <div className="p-5 flex items-center gap-4">
        {/* Icon container */}
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isSelected 
              ? 'linear-gradient(135deg, #8B1E25 0%, #C5A46D 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
            border: `1px solid ${isSelected ? 'rgba(197, 164, 109, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
            boxShadow: isSelected ? '0 4px 16px rgba(139, 30, 37, 0.3)' : 'none'
          }}
        >
          <Icon 
            className="w-5 h-5" 
            style={{ 
              color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)' 
            }} 
          />
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <h4 
            className="font-semibold text-base mb-0.5"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              color: isSelected ? '#C5A46D' : '#ffffff'
            }}
          >
            {title}
          </h4>
          <p 
            className="text-xs"
            style={{ color: 'rgba(255, 255, 255, 0.4)' }}
          >
            {description}
          </p>
        </div>
        
        {/* Selection indicator */}
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
          style={{
            background: isSelected 
              ? 'linear-gradient(135deg, #C5A46D 0%, #8B1E25 100%)'
              : 'transparent',
            border: `2px solid ${isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.2)'}`,
            boxShadow: isSelected ? '0 2px 8px rgba(197, 164, 109, 0.4)' : 'none'
          }}
        >
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Check className="w-3.5 h-3.5 text-white" />
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Selection glow effect */}
      {isSelected && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at left, rgba(197, 164, 109, 0.1) 0%, transparent 70%)'
          }}
        />
      )}
    </motion.div>
  );
};
