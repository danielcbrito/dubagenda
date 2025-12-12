import { Check, Clock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  nome: string;
  descricao: string;
  duracao_minutos: number;
  preco: number;
}

interface ServiceCardProps {
  service: Service;
  isSelected: boolean;
  onToggle: () => void;
  index: number;
}

export const ServiceCard = ({ service, isSelected, onToggle, index }: ServiceCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={cn(
        "relative cursor-pointer rounded-[20px] overflow-hidden transition-all duration-400",
        isSelected && "ring-2 ring-[#C5A46D]"
      )}
      style={{
        background: isSelected 
          ? 'linear-gradient(135deg, rgba(139, 30, 37, 0.15) 0%, rgba(197, 164, 109, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isSelected ? 'rgba(197, 164, 109, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
        boxShadow: isSelected 
          ? '0 8px 32px rgba(139, 30, 37, 0.2), 0 0 60px rgba(197, 164, 109, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Top shine line */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: isSelected 
            ? 'linear-gradient(90deg, transparent 10%, rgba(197, 164, 109, 0.5) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.15) 50%, transparent 90%)'
        }}
      />
      
      <div className="p-5 relative">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 
                className="font-semibold text-base"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  color: isSelected ? '#C5A46D' : '#ffffff'
                }}
              >
                {service.nome}
              </h4>
              
              {isSelected && (
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="rounded-full p-1.5 flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #C5A46D 0%, #8B1E25 100%)',
                    boxShadow: '0 4px 12px rgba(197, 164, 109, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </motion.div>
              )}
            </div>
            
            {service.descricao && (
              <p 
                className="text-sm leading-relaxed mb-4"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                {service.descricao}
              </p>
            )}
            
            <div className="flex items-center justify-between">
              <span 
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: 'rgba(255, 255, 255, 0.4)' }}
              >
                <Clock className="w-4 h-4" />
                {service.duracao_minutos} min
              </span>
              
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C5A46D]" />
                <span 
                  className="font-bold text-lg"
                  style={{ 
                    fontFamily: "'Montserrat', sans-serif",
                    color: '#C5A46D',
                    textShadow: '0 2px 12px rgba(197, 164, 109, 0.4)'
                  }}
                >
                  R$ {service.preco.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Selection glow effect */}
      {isSelected && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(197, 164, 109, 0.1) 0%, transparent 70%)'
          }}
        />
      )}
    </motion.div>
  );
};
