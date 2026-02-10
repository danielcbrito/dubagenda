import { AlertTriangle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface PlanExpiredBannerProps {
  planName: string;
  onRenew: () => void;
}

export function PlanExpiredBanner({ planName, onRenew }: PlanExpiredBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 border border-yellow-500/30"
      style={{
        background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.05))",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-yellow-500/20">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-300">
            Plano expirado
          </p>
          <p className="text-xs text-yellow-200/60 mt-0.5">
            Seu <span className="font-medium">{planName}</span> venceu. Renove para continuar aproveitando os benefícios.
          </p>
          <Button
            size="sm"
            onClick={onRenew}
            className="mt-2.5 h-8 text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg group"
          >
            Renovar plano
            <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
