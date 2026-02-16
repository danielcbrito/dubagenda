import { ChevronRight, Scissors } from "lucide-react";
import { motion } from "framer-motion";

interface LoyaltyCardProps {
  points: number;
  redemptions: number;
  pontosNecessarios?: number;
  onViewDetails: () => void;
}

function ProgressStep({ filled, index }: { filled: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="flex-1 flex justify-center"
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
          filled
            ? "bg-primary/90"
            : "bg-muted/20 border border-border/40"
        }`}
        style={filled ? { boxShadow: "0 0 8px hsl(var(--primary) / 0.25)" } : undefined}
      >
        <Scissors className={`w-3.5 h-3.5 transition-colors ${
          filled ? "text-primary-foreground" : "text-muted-foreground/20"
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative rounded-xl border border-border/30 bg-card/80"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[9px] font-semibold text-muted-foreground/35 uppercase tracking-[0.2em] mb-0.5">
              Fidelidade
            </p>
            <p className="text-foreground/80 font-medium text-[14px] tracking-tight">
              {pontosNecessarios} cortes → 1 grátis
            </p>
          </div>

          {redemptions > 0 && (
            <div className="px-2 py-0.5 rounded-md bg-primary/8 border border-primary/15">
              <span className="text-primary/80 text-[10px] font-bold tabular-nums">
                {redemptions}x
              </span>
            </div>
          )}
        </div>

        {/* Progress Icons */}
        <div className="flex items-center gap-1.5 mb-3.5">
          {steps.map((filled, index) => (
            <ProgressStep key={index} filled={filled} index={index} />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-3.5">
          <div className="h-[3px] rounded-full bg-muted/15 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-primary/70"
            />
          </div>
        </div>

        {/* Status + details */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground/60">
            {cutsUntilFree === 0 ? (
              <span className="text-primary font-semibold">Resgate disponível</span>
            ) : (
              <>
                Faltam{" "}
                <span className="text-foreground/80 font-semibold tabular-nums">{cutsUntilFree}</span>
                {" "}corte{cutsUntilFree > 1 ? "s" : ""}
              </>
            )}
          </p>

          <button
            onClick={onViewDetails}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors group active:scale-95"
          >
            <span>Detalhes</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
