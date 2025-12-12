import { motion } from "framer-motion";
import { Calendar, Clock, Scissors, CreditCard, Sparkles } from "lucide-react";

interface Service {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco: number;
}

interface BookingSummaryCardProps {
  services: Service[];
  date: Date;
  time: string;
  paymentMethod: 'pix' | 'card' | 'cash';
  availableCredits: number;
}

const paymentMethodLabels = {
  pix: 'PIX',
  card: 'Cartão de Crédito',
  cash: 'Pagar na Barbearia',
};

export const BookingSummaryCard = ({ 
  services, 
  date, 
  time, 
  paymentMethod,
  availableCredits 
}: BookingSummaryCardProps) => {
  const totalPrice = services.reduce((sum, s) => sum + s.preco, 0);
  const creditsApplied = Math.min(availableCredits, totalPrice);
  const finalPrice = Math.max(0, totalPrice - creditsApplied);
  const isCoveredByCredits = availableCredits >= totalPrice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-[20px] overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(197, 164, 109, 0.15)',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      {/* Top shine line */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 10%, rgba(197, 164, 109, 0.4) 50%, transparent 90%)'
        }}
      />
      
      <div className="p-5 space-y-4">
        {/* Service row */}
        <div className="flex items-start gap-4 pb-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(197, 164, 109, 0.15) 0%, rgba(139, 30, 37, 0.1) 100%)',
              border: '1px solid rgba(197, 164, 109, 0.2)'
            }}
          >
            <Scissors className="w-4 h-4 text-[#C5A46D]" />
          </div>
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Serviços</p>
            <p className="font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {services.map(s => s.nome).join(", ")}
            </p>
          </div>
        </div>
        
        {/* Date row */}
        <div className="flex items-start gap-4 pb-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(197, 164, 109, 0.15) 0%, rgba(139, 30, 37, 0.1) 100%)',
              border: '1px solid rgba(197, 164, 109, 0.2)'
            }}
          >
            <Calendar className="w-4 h-4 text-[#C5A46D]" />
          </div>
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Data</p>
            <p className="font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {date.toLocaleDateString('pt-BR', { 
                weekday: 'long',
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
        </div>
        
        {/* Time row */}
        <div className="flex items-start gap-4 pb-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(197, 164, 109, 0.15) 0%, rgba(139, 30, 37, 0.1) 100%)',
              border: '1px solid rgba(197, 164, 109, 0.2)'
            }}
          >
            <Clock className="w-4 h-4 text-[#C5A46D]" />
          </div>
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Horário</p>
            <p className="font-medium text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {time}
            </p>
          </div>
        </div>
        
        {/* Payment method row */}
        <div className="flex items-start gap-4 pb-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(197, 164, 109, 0.15) 0%, rgba(139, 30, 37, 0.1) 100%)',
              border: '1px solid rgba(197, 164, 109, 0.2)'
            }}
          >
            <CreditCard className="w-4 h-4 text-[#C5A46D]" />
          </div>
          <div className="flex-1">
            <p className="text-xs mb-1" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Pagamento</p>
            <p className="font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {isCoveredByCredits ? 'Crédito do App' : paymentMethodLabels[paymentMethod]}
            </p>
          </div>
        </div>
        
        {/* Price summary */}
        <div 
          className="pt-2 rounded-2xl p-4 -mx-1"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 30, 37, 0.1) 0%, rgba(197, 164, 109, 0.05) 100%)'
          }}
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Valor do serviço</span>
              <span>R$ {totalPrice.toFixed(2)}</span>
            </div>
            
            {creditsApplied > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-400">Créditos aplicados</span>
                <span className="text-emerald-400">- R$ {creditsApplied.toFixed(2)}</span>
              </div>
            )}
            
            <div 
              className="flex justify-between items-center pt-3 mt-2"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
            >
              <span className="font-semibold">Total a pagar</span>
              <div className="flex items-center gap-2">
                {isCoveredByCredits && <Sparkles className="w-4 h-4 text-emerald-400" />}
                <span 
                  className="text-2xl font-bold"
                  style={{ 
                    fontFamily: "'Montserrat', sans-serif",
                    color: '#C5A46D',
                    textShadow: '0 2px 16px rgba(197, 164, 109, 0.5)'
                  }}
                >
                  R$ {finalPrice.toFixed(2)}
                </span>
              </div>
            </div>
            
            {isCoveredByCredits && (
              <p className="text-xs text-center text-emerald-400 mt-2">
                Corte 100% coberto por créditos
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
