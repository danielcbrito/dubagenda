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
        className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
          filled
            ? "bg-neutral-900 shadow-sm scale-110"
            : "bg-neutral-100 border border-neutral-200"
        }`}
      >
        <Scissors className={`w-3 h-3 sm:w-4 sm:h-4 transition-colors ${
          filled ? "text-white" : "text-neutral-400"
        }`} />
      </div>
    </motion.div>
  );
}

export function LoyaltyCard({ points, redemptions, pontosNecessarios = 8, onViewDetails }: LoyaltyCardProps) {
  // Se os pontos forem exatamente o necessário, mostramos todos preenchidos
  const currentCycleProgress = points === pontosNecessarios ? pontosNecessarios : (points % pontosNecessarios);
  const steps = Array.from({ length: pontosNecessarios }, (_, i) => i < currentCycleProgress);
  const progressPercent = Math.min(100, (currentCycleProgress / pontosNecessarios) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-neutral-200/60 overflow-hidden"
    >
      <button
        onClick={onViewDetails}
        className="w-full text-left p-5 sm:p-6 active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[12px] font-medium tracking-widest uppercase text-neutral-900">
            Fidelidade
          </span>
          {redemptions > 0 && (
            <div className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/20 backdrop-blur-md">
              <span className="text-emerald-700 text-[10px] font-medium tabular-nums">
                {redemptions}x Disponível
              </span>
            </div>
          )}
        </div>

        {/* Progress Icons */}
        <div className="flex items-center justify-between gap-0.5 sm:gap-1 mb-5">
          {steps.map((filled, index) => (
            <ProgressStep key={index} filled={filled} index={index} />
          ))}
        </div>

        {/* Progress bar and text */}
        <div className="flex items-center gap-3">
          <div className="h-[6px] flex-1 rounded-full bg-neutral-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-neutral-900"
            />
          </div>
          <span className="text-[11px] font-medium text-neutral-600 whitespace-nowrap">
            {currentCycleProgress} / {pontosNecessarios}
          </span>
        </div>
      </button>
    </motion.div>
  );
}
