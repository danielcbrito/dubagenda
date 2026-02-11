import { Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface PendingSubscriptionBannerProps {
  planName: string;
  onFinalize: () => void;
}

/**
 * Banner exibido quando o usuário iniciou a assinatura mas não finalizou o pagamento.
 * Incentiva a conclusão do processo com CTA claro.
 */
export function PendingSubscriptionBanner({ planName, onFinalize }: PendingSubscriptionBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 border border-primary/30"
      style={{
        background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(251,191,36,0.05))",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/15">
          <Clock className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Assinatura pendente
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Finalize o pagamento do <span className="font-medium text-foreground">{planName}</span> para ativar seus benefícios.
          </p>
          <Button
            size="sm"
            onClick={onFinalize}
            className="mt-2.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg group"
          >
            Finalizar pagamento
            <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
