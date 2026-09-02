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
  const isCustom = effectiveDuration !== undefined && effectiveDuration !== service.duracao_minutos;
  return (
    <div
      className={cn(
        "w-full text-left rounded-xl p-3.5 transition-all duration-200 border",
        "active:scale-[0.99]",
        isSelected 
          ? "bg-primary/5 border-primary/30 ring-1 ring-primary/10" 
          : "bg-card border-border/50 hover:border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info — clicável para toggle */}
        <button
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <h3 className="text-[14px] font-semibold text-foreground mb-0.5">
            {service.nome}
          </h3>

          {/* Plan service badge */}
          {isPlanService && (
            <div className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full mb-1.5">
              <Crown className="w-2.5 h-2.5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Coberto pelo plano</span>
            </div>
          )}

          {service.descricao && (
            <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">
              {service.descricao}
            </p>
          )}
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{duration * (quantity || 1)} min</span>
            </div>
            <div className="flex items-baseline gap-1">
              {isPlanService ? (
                <>
                  <span className="text-[11px] text-muted-foreground/50 line-through tabular-nums">
                    R$ {(service.preco * (quantity || 1)).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[12px] font-bold text-emerald-400">Grátis</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-muted-foreground">R$</span>
                  <span className="text-[13px] font-semibold text-foreground tabular-nums">
                    {(service.preco * (quantity || 1)).toFixed(2).replace('.', ',')}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        {/* Controle de seleção / quantidade */}
        <div className="flex-shrink-0 flex items-center gap-1.5 mt-1">
          <AnimatePresence mode="wait">
            {isSelected ? (
              <motion.div
                key="qty-controls"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDecrement();
                  }}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                    "bg-muted/50 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  )}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>

                <span className="w-6 text-center text-sm font-bold text-foreground tabular-nums">
                  {quantity}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onIncrement();
                  }}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                    "bg-primary/15 hover:bg-primary/25 text-primary"
                  )}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="check-circle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={onToggle}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center",
                  "border-muted-foreground/40"
                )}
                aria-label="Selecionar serviço"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}