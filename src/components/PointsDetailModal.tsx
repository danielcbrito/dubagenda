import { Scissors, Award, Gift, Info, Star, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
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

function StatCard({ value, label, delay }: { value: string | number; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl bg-card border border-border/30 p-3.5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none"
    >
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">{label}</p>
    </motion.div>
  );
}

function RuleItem({ icon: Icon, title, description, index }: { icon: React.ElementType; title: string; description: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.05 }}
      className="flex items-start gap-3 py-3"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export function PointsDetailModal({ 
  open, 
  onOpenChange, 
  points, 
  completedAppointments, 
  redemptions,
  pontosNecessarios = 5
}: PointsDetailModalProps) {
  const currentCycleProgress = points % pontosNecessarios;
  const cutsUntilFree = pontosNecessarios - currentCycleProgress;
  const progressPercent = (currentCycleProgress / pontosNecessarios) * 100;

  const rules = [
    {
      icon: Scissors,
      title: "Ganhe pontos a cada corte",
      description: "Cada serviço concluído e pago soma 1 ponto automaticamente no seu programa de fidelidade."
    },
    {
      icon: Gift,
      title: `Complete ${pontosNecessarios} pontos`,
      description: `Ao atingir ${pontosNecessarios} pontos, você desbloqueia 1 corte grátis para usar no próximo agendamento.`
    },
    {
      icon: CheckCircle2,
      title: "Use seu resgate",
      description: "Na hora de agendar, selecione o resgate disponível. O serviço será gratuito."
    },
    {
      icon: AlertTriangle,
      title: "Apenas barbearias participantes",
      description: "Os pontos só são acumulados em barbearias que possuem o programa de fidelidade ativo. Se a sua barbearia não participa, os pontos não serão contabilizados."
    },
    {
      icon: Star,
      title: "Ciclo contínuo",
      description: "Após cada resgate, o contador reinicia automaticamente. Continue acumulando pontos para mais cortes grátis!"
    },
  ];

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
          {/* Header fixo */}
          <div className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 hover:bg-muted transition-colors active:scale-90"
              >
                <BackArrow size={18} className="text-foreground" />
              </button>
              <h1 className="text-[14px] font-semibold text-foreground tracking-tight">Programa de Fidelidade</h1>
            </div>
          </div>

          {/* Área scrollável */}
          <div className="flex-1 min-h-0 relative">
            <div
              className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
            />
            <div className="h-full overflow-y-auto overscroll-contain pb-24 px-4">

              {/* Progress Section */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-xl border border-border/30 bg-card p-5 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-none"
              >
                {/* Steps */}
                <div className="flex items-center justify-between mb-4">
                  {Array.from({ length: pontosNecessarios }, (_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 400, damping: 25 }}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all border-2",
                        i < currentCycleProgress
                          ? "bg-primary/15 border-primary text-primary"
                          : "bg-muted/50 border-border text-muted-foreground/40"
                      )}>
                        <Scissors className="w-4 h-4" />
                      </div>
                      <span className={cn(
                        "text-[10px] font-semibold tabular-nums",
                        i < currentCycleProgress ? "text-primary" : "text-muted-foreground/40"
                      )}>
                        {i + 1}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                  />
                </div>

                {/* Status */}
                <div className="text-center">
                  <p className="text-[13px] text-muted-foreground">
                    {cutsUntilFree === 0 ? (
                      <span className="text-primary font-bold text-[14px]">🎉 Resgate disponível!</span>
                    ) : (
                      <>
                        Faltam{" "}
                        <span className="text-foreground font-bold tabular-nums">{cutsUntilFree}</span>
                        {" "}corte{cutsUntilFree > 1 ? "s" : ""} para o grátis
                      </>
                    )}
                  </p>
                </div>

                {/* Redemption badge */}
                {redemptions > 0 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                    className="flex items-center justify-center gap-2 mt-4 px-4 py-2.5 bg-primary/10 rounded-xl border border-primary/20"
                  >
                    <Award className="w-4 h-4 text-primary" />
                    <span className="text-[13px] font-bold text-foreground">
                      {redemptions} {redemptions === 1 ? "resgate disponível" : "resgates disponíveis"}
                    </span>
                  </motion.div>
                )}
              </motion.div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2.5 mb-6">
                <StatCard value={points} label="Pontos" delay={0.15} />
                <StatCard value={completedAppointments} label="Cortes" delay={0.2} />
                <StatCard value={redemptions} label="Resgates" delay={0.25} />
              </div>

              {/* Rules Section */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
                    Como funciona
                  </p>
                </div>

                <div className="rounded-xl border border-border/30 bg-card px-4 divide-y divide-border/20 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
                  {rules.map((rule, index) => (
                    <RuleItem key={index} {...rule} index={index} />
                  ))}
                </div>
              </motion.div>

              {/* Tip */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4"
              >
                <div className="flex items-start gap-3">
                  <Gift className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground mb-1">Dica</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Mantenha seus agendamentos sempre na mesma barbearia participante para acumular pontos mais rápido e não perder seu progresso!
                    </p>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
