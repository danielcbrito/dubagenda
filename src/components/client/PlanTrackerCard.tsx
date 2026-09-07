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
  cashPending,
}: PlanTrackerCardProps) {
  const used = Math.max(0, Math.min(usedAppointments, totalAppointments));
  const remaining = Math.max(0, totalAppointments - usedAppointments);
  const progress = totalAppointments > 0 ? (used / totalAppointments) * 100 : 0;
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
      className="rounded-[24px] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-neutral-100 overflow-hidden"
    >
      <div className="p-5">
        {/* Cash pending — subtle inline notice */}
        {cashPending && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium">
              Pagamento pendente na barbearia
            </p>
          </div>
        )}

        {/* Top row: Plan name + remaining badge */}
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium text-neutral-900 truncate tracking-tight">
              {planName}
            </h3>
            {servicoNome && (
              <p className="text-[12px] text-neutral-500 mt-0.5 truncate">
                {servicoNome}
              </p>
            )}
          </div>

          <div
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-medium tabular-nums shrink-0 ml-3 border",
              remaining > 0
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : "bg-red-50 text-red-600 border-red-100"
            )}
          >
            {`${used}/${totalAppointments}`}
          </div>
        </div>

        {/* Clean progress bar */}
        <div className="mb-4">
          <div className="w-full h-1.5 rounded-full bg-neutral-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
              className={cn(
                "h-full rounded-full",
                canRenew ? "bg-red-500" : "bg-neutral-900"
              )}
            />
          </div>
        </div>

        {/* Bottom info row */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-neutral-500 tabular-nums">
            {canRenew ? "Plano esgotado" : `Renova em ${formattedDate}`}
            {diasRestantes !== undefined && diasRestantes > 0 && !canRenew && (
              <span className="text-neutral-400"> · {diasRestantes}d</span>
            )}
          </p>

          <button
            onClick={onViewDetails}
            className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors group"
          >
            <span>Detalhes</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

      </div>
    </motion.div>
  );
}
