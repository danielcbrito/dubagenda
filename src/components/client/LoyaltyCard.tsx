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
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
          filled
            ? "bg-primary"
            : "bg-muted/50 border border-border"
        }`}
        style={filled ? { boxShadow: "0 0 8px hsl(var(--primary) / 0.25)" } : undefined}
      >
        <Scissors className={`w-3 h-3 transition-colors ${
          filled ? "text-primary-foreground" : "text-muted-foreground/40"
        }`} />
      </div>
    </motion.div>
  );
}

export function LoyaltyCard({ points, redemptions, pontosNecessarios = 5, onViewDetails }: LoyaltyCardProps) {
  // Se os pontos forem exatamente o necessário, mostramos todos preenchidos
  const currentCycleProgress = points === pontosNecessarios ? pontosNecessarios : (points % pontosNecessarios);
  const cutsUntilFree = Math.max(0, pontosNecessarios - currentCycleProgress);
  const steps = Array.from({ length: pontosNecessarios }, (_, i) => i < currentCycleProgress);
  const progressPercent = Math.min(100, (currentCycleProgress / pontosNecessarios) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative rounded-xl border border-border bg-card"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <p className="text-[8px] font-semibold text-muted-foreground/60 uppercase tracking-[0.2em] mb-0.5">
              Fidelidade
            </p>
            <p className="text-foreground font-medium text-[13px] tracking-tight">
              {pontosNecessarios} cortes → 1 grátis
            </p>
          </div>

          {redemptions > 0 && (
            <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
              <span className="text-primary text-[9px] font-bold tabular-nums">
                {redemptions}x
              </span>
            </div>
          )}
        </div>

        {/* Progress Icons */}
        <div className="flex items-center gap-1 mb-3">
          {steps.map((filled, index) => (
            <ProgressStep key={index} filled={filled} index={index} />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="h-[3px] rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>

        {/* Status + details */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {cutsUntilFree === 0 ? (
              <span className="text-primary font-semibold">Resgate disponível</span>
            ) : (
              <>
                Faltam{" "}
                <span className="text-foreground font-semibold tabular-nums">{cutsUntilFree}</span>
                {" "}corte{cutsUntilFree > 1 ? "s" : ""}
              </>
            )}
          </p>

          <button
            onClick={onViewDetails}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors group active:scale-95"
          >
            <span>Detalhes</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
