import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlanRenewalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  planPrice?: number;
  serviceName?: string;
}

export function PlanRenewalDrawer({ open, onOpenChange, planName, planPrice, serviceName }: PlanRenewalDrawerProps) {
  const navigate = useNavigate();
  const newCycleEnd = format(addDays(new Date(), 30), "dd 'de' MMMM", { locale: ptBR });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border/40 bg-card"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/15" />
            </div>

            <div className="px-5 pb-6 pt-2">
              {/* Resumo */}
              <div className="rounded-xl bg-muted/50 p-4 space-y-2 mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Resumo da renovação
                </p>
                <div className="space-y-1.5">
                  <p className="text-[13px] text-foreground font-medium">{planName}</p>
                  {serviceName && (
                    <p className="text-[12px] text-muted-foreground">Serviço: {serviceName}</p>
                  )}
                  {planPrice != null && planPrice > 0 && (
                    <p className="text-[13px] text-foreground font-semibold tabular-nums">
                      R$ {planPrice.toFixed(2)}/mês
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Novo ciclo: hoje → {newCycleEnd}
                  </p>
                </div>
                <div className="mt-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 inline-block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    Ciclo anterior encerrado
                  </span>
                </div>
              </div>

              {/* Botões */}
              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/cliente/assinar");
                  }}
                  className={cn(
                    "w-full h-12 rounded-xl font-semibold text-[13px]",
                    "bg-foreground text-background",
                    "flex items-center justify-center",
                    "active:scale-[0.98] transition-transform"
                  )}
                >
                  Renovar plano
                </button>

                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/cliente/assinar");
                  }}
                  className={cn(
                    "w-full h-12 rounded-xl font-medium text-[13px]",
                    "border border-border/50 bg-card text-foreground",
                    "flex items-center justify-center gap-2",
                    "hover:bg-muted/50 active:scale-[0.98] transition-all"
                  )}
                >
                  Escolher outro plano
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              <button
                onClick={() => onOpenChange(false)}
                className="w-full mt-3 py-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Agora não
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
