import { AlertTriangle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface PlanExpiredBannerProps {
  planName: string;
  onRenew: () => void;
}

/**
 * Card exibido quando a assinatura do usuário expirou por falta de pagamento.
 * Apenas para assinaturas que foram ativas e venceram — design consistente com o app.
 */
export function PlanExpiredBanner({ planName, onRenew }: PlanExpiredBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card"
      style={{ boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.3)" }}
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-semibold text-sm tracking-tight">
              {planName}
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">
              Assinatura vencida
            </p>
          </div>
          <div className="px-2.5 py-1 rounded-lg border bg-destructive/10 border-destructive/20">
            <span className="text-xs font-bold tabular-nums text-destructive">
              Vencido
            </span>
          </div>
        </div>

        {/* Message */}
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Renove seu plano para continuar aproveitando os benefícios exclusivos.
        </p>

        {/* CTA */}
        <button
          onClick={onRenew}
          className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold flex items-center justify-center gap-2 transition-all group"
        >
          Renovar plano
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}
