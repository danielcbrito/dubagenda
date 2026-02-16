import { Check, Plus, Minus } from "lucide-react";
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
  onToggle: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function ServiceCard({ 
  service, 
  isSelected, 
  quantity, 
  onToggle, 
  onIncrement, 
  onDecrement 
}: ServiceCardProps) {
  return (
    <div
      className={cn(
        "w-full text-left rounded-lg p-3 transition-all duration-200 border",
        isSelected 
          ? "bg-primary/10 border-primary/50" 
          : "bg-card border-border hover:bg-secondary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Info — clicável para toggle */}
        <button
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <h3 className="text-sm font-semibold text-foreground mb-0.5">
            {service.nome}
          </h3>
          {service.descricao && (
            <p className="text-[11px] text-muted-foreground mb-1.5 line-clamp-1">
              {service.descricao}
            </p>
          )}
          
          <div className="flex items-center gap-2.5 text-[11px]">
            <span className="text-muted-foreground">
              {service.duracao_minutos * (quantity || 1)} min
            </span>
            <span className="text-primary font-semibold">
              R$ {(service.preco * (quantity || 1)).toFixed(2).replace('.', ',')}
            </span>
          </div>
        </button>

        {/* Controle de seleção / quantidade */}
        <div className="flex-shrink-0 flex items-center gap-1.5 mt-0.5">
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
                    "bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
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
                    "bg-primary/20 hover:bg-primary/30 text-primary"
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
                  "border-muted-foreground/30"
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
