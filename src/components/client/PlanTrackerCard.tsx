import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PlanTrackerCardProps {
  planName: string;
  usedAppointments: number;
  totalAppointments: number;
  nextBillingDate: string;
  paymentMethod?: string | null;
  onViewDetails: () => void;
  servicoNome?: string;
  diasRestantes?: number;
  assinaturaId?: string;
  planoPreco?: number;
  userId?: string;
  onRenovado?: () => void;
  cashPending?: boolean;
}

export function PlanTrackerCard({
  planName,
  usedAppointments,
  totalAppointments,
  nextBillingDate,
  onViewDetails,
  servicoNome,
  diasRestantes,
  assinaturaId,
  userId,
  cashPending,
}: PlanTrackerCardProps) {
  const navigate = useNavigate();

  const remaining = Math.max(0, totalAppointments - usedAppointments);
  const progress = totalAppointments > 0 ? (usedAppointments / totalAppointments) * 100 : 0;
  const canRenew = remaining === 0;

  const formattedDate = (() => {
    try {
      const d = new Date(nextBillingDate + "T00:00:00");
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch {
      return nextBillingDate;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl border border-border/50 bg-card overflow-hidden"
    >
      <div className="p-4">
        {/* Cash pending — subtle inline notice */}
        {cashPending && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Pagamento pendente na barbearia
            </p>
          </div>
        )}

        {/* Top row: Plan name + remaining badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {planName}
            </h3>
            {servicoNome && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                {servicoNome}
              </p>
            )}
          </div>

          <div
            className={cn(
              "px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums shrink-0 ml-3",
              remaining > 0
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {remaining > 0 ? `${remaining}/${totalAppointments}` : "0/" + totalAppointments}
          </div>
        </div>

        {/* Clean progress bar */}
        <div className="mb-3">
          <div className="w-full h-1.5 rounded-full bg-muted-foreground/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
              className={cn(
                "h-full rounded-full",
                canRenew ? "bg-destructive" : "bg-emerald-400"
              )}
            />
          </div>
        </div>

        {/* Bottom info row */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {canRenew ? "Plano esgotado" : `Renova em ${formattedDate}`}
            {diasRestantes !== undefined && diasRestantes > 0 && !canRenew && (
              <span className="text-muted-foreground/50"> · {diasRestantes}d</span>
            )}
          </p>

          <button
            onClick={onViewDetails}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span>Detalhes</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

      </div>
    </motion.div>
  );
}
