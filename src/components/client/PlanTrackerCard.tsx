import { ChevronRight, Banknote, QrCode, Sparkles } from "lucide-react";
import { ChevronRight, Banknote, QrCode, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface PlanTrackerCardProps {
  planName: string;
  usedAppointments: number;
  totalAppointments: number;
  nextBillingDate: string;
  paymentMethod?: string | null;
  onViewDetails: () => void;
  // New props for renewal flow
  servicoNome?: string;
  diasRestantes?: number;
  assinaturaId?: string;
  planoPreco?: number;
  userId?: string;
  onRenovado?: () => void;
}

function ProgressStep({ filled, index }: { filled: boolean; index: number }) {
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
            ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
            : "bg-muted-foreground/15"
        }`}
      />
      <span className={`text-[10px] tabular-nums font-medium transition-colors ${
        filled ? "text-amber-400" : "text-muted-foreground/40"
      }`}>
        {index + 1}
      </span>
    </motion.div>
  );
}

export function PlanTrackerCard({
  planName,
  usedAppointments,
  totalAppointments,
  nextBillingDate,
  paymentMethod,
  onViewDetails,
  servicoNome,
  diasRestantes,
  assinaturaId,
  planoPreco,
  userId,
  onRenovado,
}: PlanTrackerCardProps) {
  const navigate = useNavigate();

  const remaining = Math.max(0, totalAppointments - usedAppointments);
  const steps = Array.from({ length: totalAppointments }, (_, i) => i < usedAppointments);
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
    <>
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
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        <div className="relative z-10 p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-foreground font-semibold text-sm tracking-tight">
                {planName}
              </h3>
              {servicoNome && (
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {servicoNome}
                </p>
              )}
              <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
                <span>Renova em {formattedDate}</span>
                {paymentMethod && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    {paymentMethod === 'cash' ? (
                      <><Banknote className="w-3 h-3" /> Dinheiro</>
                    ) : (
                      <><QrCode className="w-3 h-3" /> PIX</>
                    )}
                  </span>
                )}
              </p>
            </div>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`px-2.5 py-1 rounded-lg border ${
                remaining > 0
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-destructive/10 border-destructive/20"
              }`}
            >
              <span className={`text-xs font-bold tabular-nums ${
                remaining > 0 ? "text-emerald-400" : "text-destructive"
              }`}>
                {remaining > 0 ? `${remaining} restante${remaining > 1 ? "s" : ""}` : "Esgotado"}
              </span>
            </motion.div>
          </div>

          {/* Progress */}
          <div className="mb-3">
            <div className="flex items-start gap-2">
              {steps.map((filled, index) => (
                <ProgressStep key={index} filled={filled} index={index} />
              ))}
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-semibold tabular-nums">{usedAppointments}</span>
              {" "}de {totalAppointments} usados
            </p>

            {diasRestantes !== undefined && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {diasRestantes > 0 ? `${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} restante${diasRestantes > 1 ? "s" : ""}` : "Ciclo encerrado"}
              </p>
            )}
          </div>

          {/* Ready to renew badge */}
          {canRenew && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3"
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                </motion.div>
                <span className="text-[11px] font-semibold text-emerald-400">
                  Pronto para renovar!
                </span>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {assinaturaId && planoPreco !== undefined && userId && (
              <button
                onClick={() => {
                  if (canRenew) setRenewOpen(true);
                }}
                disabled={!canRenew}
                className={cn(
                  "flex-1 h-9 rounded-xl text-[12px] font-semibold transition-all",
                  canRenew
                    ? "bg-foreground text-background active:scale-[0.97]"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                Renovar plano
              </button>
            )}

            <button
              onClick={onViewDetails}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors group px-2"
            >
              <span>Ver plano</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Disabled message */}
          {!canRenew && assinaturaId && (
            <p className="text-[10px] text-muted-foreground/50 mt-2">
              Use os {remaining} serviço{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""} para renovar
            </p>
          )}
        </div>
      </motion.div>

      {/* Renewal Sheet */}
      {assinaturaId && planoPreco !== undefined && userId && (
        <RenovacaoSheet
          open={renewOpen}
          onOpenChange={setRenewOpen}
          assinaturaId={assinaturaId}
          planoNome={planName}
          planoPreco={planoPreco}
          servicoNome={servicoNome || "Serviço"}
          userId={userId}
          onRenovado={onRenovado || (() => {})}
        />
      )}
    </>
  );
}
