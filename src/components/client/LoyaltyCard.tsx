import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface LoyaltyCardProps {
  points: number;
  redemptions: number;
  onViewDetails: () => void;
}

function ProgressStep({ filled, index, total }: { filled: boolean; index: number; total: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className="flex flex-col items-center gap-1.5 flex-1"
    >
      <div
        className={`w-full h-1.5 rounded-full transition-all duration-500 ${
          filled
            ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
            : "bg-muted-foreground/15"
        }`}
      />
      <span className={`text-[10px] tabular-nums font-medium transition-colors ${
        filled ? "text-primary" : "text-muted-foreground/40"
      }`}>
        {index + 1}
      </span>
    </motion.div>
  );
}

export function LoyaltyCard({ points, redemptions, onViewDetails }: LoyaltyCardProps) {
  const currentCycleProgress = points % 5;
  const cutsUntilFree = 5 - currentCycleProgress;
  const steps = Array.from({ length: 5 }, (_, i) => i < currentCycleProgress);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card"
      style={{
        boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-foreground font-semibold text-sm tracking-tight">
              Programa Fidelidade
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">
              A cada 5 cortes, ganhe 1 grátis
            </p>
          </div>

          {redemptions > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20"
            >
              <span className="text-primary text-xs font-bold tabular-nums">
                {redemptions} {redemptions === 1 ? "resgate" : "resgates"}
              </span>
            </motion.div>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-start gap-2">
            {steps.map((filled, index) => (
              <ProgressStep key={index} filled={filled} index={index} total={5} />
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {cutsUntilFree === 0 ? (
              <span className="text-primary font-semibold">Resgate disponível</span>
            ) : (
              <>
                <span className="text-foreground font-semibold tabular-nums">{cutsUntilFree}</span>
                {" "}corte{cutsUntilFree > 1 ? "s" : ""} para o próximo grátis
              </>
            )}
          </p>

          <button
            onClick={onViewDetails}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span>Detalhes</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
