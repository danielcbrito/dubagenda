import { Crown, CalendarCheck, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface PlanTrackerCardProps {
  planName: string;
  usedAppointments: number;
  totalAppointments: number;
  nextBillingDate: string;
  onViewDetails: () => void;
}

function UsageSlot({ used, index }: { used: boolean; index: number }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="flex-1 flex flex-col items-center gap-1.5"
    >
      <div
        className={`w-full h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
          used
            ? "bg-white/25 shadow-[0_0_16px_rgba(255,255,255,0.2)]"
            : "bg-white/10 border border-white/10"
        }`}
      >
        {used ? (
          <CalendarCheck className="w-5 h-5 text-white" />
        ) : (
          <span className="text-white/30 text-xs font-bold">—</span>
        )}
      </div>
    </motion.div>
  );
}

export function PlanTrackerCard({
  planName,
  usedAppointments,
  totalAppointments,
  nextBillingDate,
  onViewDetails,
}: PlanTrackerCardProps) {
  const remaining = Math.max(0, totalAppointments - usedAppointments);
  const slots = Array.from({ length: totalAppointments }, (_, i) => i < usedAppointments);

  // Formatar data de renovação
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        boxShadow: "0 20px 40px -12px rgba(15, 52, 96, 0.5), 0 8px 24px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Background decorativo */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 90% 10%, rgba(251, 191, 36, 0.4) 0%, transparent 40%),
                            radial-gradient(circle at 10% 90%, rgba(251, 191, 36, 0.2) 0%, transparent 50%)`,
        }}
      />

      {/* Shine */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          background: "linear-gradient(135deg, transparent 0%, rgba(251,191,36,0.3) 50%, transparent 100%)",
          transform: "translateX(-100%)",
          animation: "shimmer 4s infinite",
        }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                boxShadow: "0 4px 12px rgba(251, 191, 36, 0.4)",
              }}
            >
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base tracking-tight">
                {planName}
              </h3>
              <p className="text-white/50 text-xs">
                Renova em {formattedDate}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{
              background: remaining > 0
                ? "rgba(34, 197, 94, 0.2)"
                : "rgba(239, 68, 68, 0.2)",
            }}
          >
            <span
              className={`text-xs font-bold ${
                remaining > 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {remaining > 0 ? `${remaining} restante${remaining > 1 ? "s" : ""}` : "Esgotado"}
            </span>
          </div>
        </div>

        {/* Slots de uso */}
        <div className="space-y-2.5 mb-4">
          <div className="flex items-center gap-2">
            {slots.map((used, index) => (
              <UsageSlot key={index} used={used} index={index} />
            ))}
          </div>

          <div className="flex items-center justify-between text-white/60 text-xs">
            <span className="font-medium">
              {usedAppointments} de {totalAppointments} agendamentos usados
            </span>
          </div>
        </div>

        {/* Botão detalhes */}
        <Button
          variant="ghost"
          onClick={onViewDetails}
          className="w-full h-9 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 group text-sm"
        >
          <span className="font-medium">Ver meu plano</span>
          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </motion.div>
  );
}
