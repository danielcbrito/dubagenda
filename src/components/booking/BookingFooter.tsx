import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Service {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco: number;
}

interface BookingFooterProps {
  selectedServices: Service[];
  onContinue: () => void;
  disabled?: boolean;
  loading?: boolean;
  buttonText?: string;
}

export const BookingFooter = ({ 
  selectedServices, 
  onContinue, 
  disabled,
  loading,
  buttonText = "Continuar"
}: BookingFooterProps) => {
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.preco, 0);

  return (
    <AnimatePresence>
      {selectedServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
          className="flex-shrink-0 p-4"
        >
          <div className="max-w-lg mx-auto space-y-3">
            {/* Premium Summary Card */}
            <motion.div 
              className="rounded-[18px] p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(197, 164, 109, 0.15)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
              }}
            >
              {/* Top shine */}
              <div 
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: 'linear-gradient(90deg, transparent 10%, rgba(197, 164, 109, 0.3) 50%, transparent 90%)'
                }}
              />
              
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    {selectedServices.length} {selectedServices.length === 1 ? 'serviço' : 'serviços'}
                  </p>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                    <Clock className="w-3.5 h-3.5" />
                    {totalDuration} minutos
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs mb-1" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                    Total
                  </p>
                  <p 
                    className="text-2xl font-bold"
                    style={{ 
                      fontFamily: "'Montserrat', sans-serif",
                      color: '#C5A46D',
                      textShadow: '0 2px 16px rgba(197, 164, 109, 0.5)'
                    }}
                  >
                    R$ {totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Premium CTA Button */}
            <Button
              onClick={onContinue}
              disabled={disabled || loading}
              className="relative w-full h-14 font-bold text-base tracking-wide overflow-hidden group rounded-[14px]"
              style={{
                background: 'linear-gradient(135deg, #8B1E25 0%, #C5A46D 100%)',
                boxShadow: '0 8px 32px rgba(139, 30, 37, 0.4), 0 0 60px rgba(197, 164, 109, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
            >
              {/* Animated shine effect */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" 
              />
              
              {/* Inner glow on hover */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%)'
                }}
              />
              
              <span className="relative flex items-center justify-center gap-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {loading ? "Processando..." : buttonText}
                {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
