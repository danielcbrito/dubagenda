import { Scissors, Award, Gift, Info, Star, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BackArrow } from "@/components/ui/back-arrow";

interface PointsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  points: number;
  completedAppointments: number;
  redemptions: number;
  pontosNecessarios?: number;
}

export function PointsDetailModal({ 
  open, 
  onOpenChange, 
  points, 
  completedAppointments, 
  redemptions,
  pontosNecessarios = 5
}: PointsDetailModalProps) {
  const currentCycleProgress = points === pontosNecessarios ? pontosNecessarios : (points % pontosNecessarios);
  const cutsUntilFree = Math.max(0, pontosNecessarios - currentCycleProgress);
  const progressPercent = Math.min(100, (currentCycleProgress / pontosNecessarios) * 100);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 active:scale-90 transition-transform"
              >
                <BackArrow size={18} className="text-foreground" />
              </button>
              <h1 className="text-[14px] font-semibold text-foreground tracking-tight">Programa de Fidelidade</h1>
            </div>
          </div>

          {/* Scroll */}
          <div className="flex-1 min-h-0 relative">
            <div
              className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
            />
            <div className="h-full overflow-y-auto overscroll-contain pb-24 px-4 space-y-5">

              {/* ── Progresso ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-xl border border-border/30 bg-card p-5"
              >
                {/* Números centrais */}
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-[32px] font-bold tabular-nums text-foreground leading-none">
                    {currentCycleProgress}
                  </span>
                  <span className="text-[14px] text-muted-foreground font-medium">
                    / {pontosNecessarios}
                  </span>
                </div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 font-semibold text-center mb-5">
                  Cortes neste ciclo
                </p>

                {/* Barra de progresso */}
                <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                  />
                </div>

                {/* Status */}
                <p className="text-[12px] text-muted-foreground text-center">
                  {cutsUntilFree === 0 ? (
                    <span className="text-primary font-bold">Resgate disponível</span>
                  ) : (
                    <>
                      Faltam{" "}
                      <span className="text-foreground font-bold tabular-nums">{cutsUntilFree}</span>
                      {" "}corte{cutsUntilFree > 1 ? "s" : ""} para o grátis
                    </>
                  )}
                </p>

                {redemptions > 0 && (
                  <div className="flex items-center justify-center gap-2 mt-4 px-4 py-2.5 bg-primary/10 rounded-xl border border-primary/20">
                    <Award className="w-4 h-4 text-primary" />
                    <span className="text-[12px] font-bold text-foreground">
                      {redemptions} {redemptions === 1 ? "resgate disponível" : "resgates disponíveis"}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* ── Resumo ── */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-border/30 bg-card divide-y divide-border/20"
              >
                {[
                  { label: "Pontos acumulados", value: points },
                  { label: "Cortes realizados", value: completedAppointments },
                  { label: "Resgates utilizados", value: redemptions },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-[12px] text-muted-foreground">{item.label}</span>
                    <span className="text-[14px] font-bold tabular-nums text-foreground">{item.value}</span>
                  </div>
                ))}
              </motion.div>

              {/* ── Regras ── */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50 font-bold mb-2.5 px-1">
                  Regras do programa
                </p>

                <div className="rounded-xl border border-border/30 bg-card divide-y divide-border/20">
                  {[
                    {
                      num: "01",
                      text: "Cada serviço de CORTE concluído e pago soma 1 ponto automaticamente.",
                    },
                    {
                      num: "02",
                      text: `Ao completar exatamente ${pontosNecessarios} pontos, você recebe 1 corte grátis.`,
                    },
                    {
                      num: "03",
                      text: "O benefício do corte grátis é exclusivo para o serviço de CORTE simples.",
                    },
                    {
                      num: "04",
                      text: "Na hora de agendar, selecione o resgate disponível para aplicar o corte grátis.",
                    },
                    {
                      num: "05",
                      text: "Pontos só são acumulados em barbearias que possuem o programa de fidelidade ativo.",
                    },
                    {
                      num: "06",
                      text: "Após o uso do corte grátis, seus pontos serão resetados para 0.",
                    },
                  ].map((rule, i) => (
                    <div key={i} className="flex items-start gap-3.5 px-4 py-3.5">
                      <span className="text-[10px] font-bold tabular-nums text-primary/70 mt-0.5 flex-shrink-0 w-5">
                        {rule.num}
                      </span>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{rule.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
