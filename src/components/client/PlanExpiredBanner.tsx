import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface PlanExpiredBannerProps {
  planName: string;
  onRenew: () => void;
}

export function PlanExpiredBanner({ planName, onRenew }: PlanExpiredBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 border border-neutral-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-[#DC2626] mt-1.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-neutral-900 tracking-tight">
            Plano expirado
          </p>
          <p className="text-[13px] text-neutral-600 mt-0.5 leading-relaxed">
            Seu <span className="font-semibold text-neutral-900">{planName}</span> venceu. Renove para continuar agendando e aproveitando os benefícios exclusivos.
          </p>
          <button
            type="button"
            onClick={onRenew}
            className="mt-3.5 h-10 px-4 text-[13.5px] bg-[#18181B] hover:bg-neutral-900 text-white font-semibold rounded-xl flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            Renovar agora
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default PlanExpiredBanner;
