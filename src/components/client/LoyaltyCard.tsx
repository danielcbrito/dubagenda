import { ChevronRight, Scissors } from "lucide-react";
import { motion } from "framer-motion";

interface LoyaltyCardProps {
  points: number;
  redemptions: number;
  pontosNecessarios?: number;
  onViewDetails: () => void;
}

function ProgressStep({ filled, index, total }: { filled: boolean; index: number; total: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="flex flex-col items-center gap-1 flex-1"
    >
      {/* Icon circle */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
          filled
            ? "bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
            : "bg-muted/40 border border-border/60"
        }`}
      >
        <Scissors className={`w-3.5 h-3.5 transition-colors ${
          filled ? "text-primary-foreground" : "text-muted-foreground/30"
        }`} />
      </div>
    </motion.div>
  );
}

export function LoyaltyCard({ points, redemptions, pontosNecessarios = 5, onViewDetails }: LoyaltyCardProps) {
  const currentCycleProgress = points % pontosNecessarios;
  const cutsUntilFree = pontosNecessarios - currentCycleProgress;
  const steps = Array.from({ length: pontosNecessarios }, (_, i) => i < currentCycleProgress);
  const progressPercent = (currentCycleProgress / pontosNecessarios) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-card"
      style={{
        boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-0.5">
              PROGRAMA FIDELIDADE
            </p>
            <p className="text-foreground font-semibold text-sm font-display tracking-tight">
              A cada {pontosNecessarios} cortes, 1 grátis
            </p>
          </div>

          {redemptions > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20"
            >
              <span className="text-primary text-[10px] font-bold tabular-nums">
                {redemptions}x resgate
              </span>
            </motion.div>
          )}
        </div>

        {/* Progress Icons */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            {steps.map((filled, index) => (
              <ProgressStep key={index} filled={filled} index={index} total={pontosNecessarios} />
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
              style={{
                boxShadow: progressPercent > 0 ? "0 0 8px hsl(var(--primary) / 0.5)" : "none",
              }}
            />
          </div>
        </div>

        {/* Status + details */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {cutsUntilFree === 0 ? (
              <span className="text-primary font-bold">Resgate disponível!</span>
            ) : (
              <>
                Faltam{" "}
                <span className="text-foreground font-bold tabular-nums text-sm">{cutsUntilFree}</span>
                {" "}corte{cutsUntilFree > 1 ? "s" : ""}
              </>
            )}
          </p>

          <button
            onClick={onViewDetails}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors group active:scale-95"
          >
            <span>Detalhes</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
