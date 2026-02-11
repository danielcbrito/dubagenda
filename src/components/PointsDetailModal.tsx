import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gift, X, Scissors, Award } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PointsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  points: number;
  completedAppointments: number;
  redemptions: number;
  pontosNecessarios?: number;
}

export function PointsDetailModal({ 
  open, 
  onOpenChange, 
  points, 
  completedAppointments, 
  redemptions,
  pontosNecessarios = 5
}: PointsDetailModalProps) {
  const currentCycleProgress = points % pontosNecessarios;
  const cutsUntilFree = pontosNecessarios - currentCycleProgress;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-sm p-0 bg-card border-border overflow-hidden rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0 flex flex-row items-center justify-between">
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <DialogTitle className="text-sm font-semibold text-foreground">
            Programa Fidelidade
          </DialogTitle>
          <div className="w-8" />
        </DialogHeader>

        <div className="px-5 pb-6 pt-4 space-y-5">
          
          {/* Progress Ring Section */}
          <div className="flex flex-col items-center gap-4">
            {/* Progress bar visual */}
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between">
                {Array.from({ length: pontosNecessarios }, (_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.08, type: "spring", stiffness: 400, damping: 25 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all border-2",
                      i < currentCycleProgress
                        ? "bg-primary/15 border-primary text-primary"
                        : "bg-muted/50 border-border text-muted-foreground/40"
                    )}>
                      <Scissors className="w-4 h-4" />
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium",
                      i < currentCycleProgress ? "text-primary" : "text-muted-foreground/50"
                    )}>
                      {i + 1}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="relative h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentCycleProgress / pontosNecessarios) * 100}%` }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 bg-primary rounded-full"
                />
              </div>
            </div>

            {/* Status text */}
            <p className="text-sm text-muted-foreground text-center">
              {cutsUntilFree === 0 
                ? "Resgate disponível" 
                : <>Faltam <span className="text-primary font-semibold">{cutsUntilFree}</span> {cutsUntilFree === 1 ? 'corte' : 'cortes'} para o grátis</>
              }
            </p>

            {/* Redemption badge */}
            {redemptions > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20"
              >
                <Award className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {redemptions} {redemptions === 1 ? 'corte grátis' : 'cortes grátis'}
                </span>
              </motion.div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/30 border border-border/50 p-3.5 text-center">
              <p className="text-xl font-bold text-foreground">{completedAppointments}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cortes realizados</p>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border/50 p-3.5 text-center">
              <p className="text-xl font-bold text-foreground">{points}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pontos acumulados</p>
            </div>
          </div>

          {/* How it works - compact */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Como funciona</p>
            <div className="space-y-1.5">
              {[
                "A cada corte concluído, ganhe 1 ponto",
                `Complete ${pontosNecessarios} pontos e ganhe 1 corte grátis`,
                "Use o resgate no próximo agendamento",
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
