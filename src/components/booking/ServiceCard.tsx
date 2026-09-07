import { Check, Plus, Minus, Clock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number;
  preco: number;
}

interface ServiceCardProps {
  service: Service;
  isSelected: boolean;
  quantity: number;
  effectiveDuration?: number;
  onToggle: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  isPlanService?: boolean;
}

export function ServiceCard({ 
  service, 
  isSelected, 
  quantity, 
  effectiveDuration,
  onToggle, 
  onIncrement, 
  onDecrement,
  isPlanService,
}: ServiceCardProps) {
  const duration = effectiveDuration ?? service.duracao_minutos;

  return (
    <div
      onClick={onToggle}
      className={cn(
        "w-full rounded-[24px] p-4 transition-all duration-200 border cursor-pointer select-none",
        "bg-white",
        isSelected 
          ? "border-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-neutral-900" 
          : "border-neutral-200/80 hover:border-neutral-300 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-neutral-900 mb-0.5 tracking-tight">
            {service.nome}
          </h3>

          {/* Plan service badge */}
          {isPlanService && (
            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full mb-1.5">
              <Crown className="w-2.5 h-2.5" />
              <span className="text-[10px] font-medium">Coberto pelo plano</span>
            </div>
          )}

          {service.descricao && (
            <p className="text-[12px] text-neutral-500 mb-2.5 line-clamp-2 leading-relaxed">
              {service.descricao}
            </p>
          )}
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px] text-neutral-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{duration * (quantity || 1)} min</span>
            </div>
            <div className="flex items-baseline gap-1">
              {isPlanService ? (
                <>
                  <span className="text-[12px] text-neutral-400 line-through tabular-nums">
                    R$ {(service.preco * (quantity || 1)).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[13px] font-semibold text-emerald-600">Grátis</span>
                </>
              ) : (
                <span className="text-[14px] font-semibold text-neutral-900 tabular-nums">
                  R$ {(service.preco * (quantity || 1)).toFixed(2).replace('.', ',')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controle de seleção / quantidade */}
        <div className="flex-shrink-0 flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
          <AnimatePresence mode="wait">
            {isSelected ? (
              <motion.div
                key="qty-controls"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 bg-neutral-100/80 p-1 rounded-full border border-neutral-200/60"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDecrement();
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-white hover:bg-neutral-200 text-neutral-700 shadow-sm transition-colors active:scale-95"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <span className="w-5 text-center text-xs font-semibold text-neutral-900 tabular-nums">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIncrement();
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm transition-colors active:scale-95"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </motion.div>
            ) : (
              <div
                onClick={onToggle}
                className="w-6 h-6 rounded-full border-2 border-neutral-300 hover:border-neutral-400 transition-all flex items-center justify-center cursor-pointer active:scale-90"
                aria-label="Selecionar serviço"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}