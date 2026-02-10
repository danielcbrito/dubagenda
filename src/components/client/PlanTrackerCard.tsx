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

function UsageSlot({ used, index, total }: { used: boolean; index: number; total: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.35, ease: "easeOut" }}
      className="flex-1 flex flex-col items-center"
    >
      <div
        className={`w-full h-11 rounded-lg flex items-center justify-center transition-all duration-500 ${
          used
            ? "border border-white/20"
            : "border border-dashed border-white/[0.08]"
        }`}
        style={used ? {
          background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
        } : {
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {used ? (
          <CalendarCheck className="w-[18px] h-[18px] text-white/80" strokeWidth={1.8} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-white/15" />
        )}
      </div>
      <span className="text-[10px] text-white/30 mt-1.5 font-medium tabular-nums">
        {index + 1}/{total}
      </span>
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(145deg, #111113 0%, #18181b 40%, #1c1c22 100%)",
        boxShadow: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 16px 40px -8px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Subtle top-left accent glow */}
      <div
        className="absolute -top-16 -left-16 w-48 h-48 rounded-full opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, #FBBF24 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)",
                boxShadow: "0 2px 8px rgba(251, 191, 36, 0.25)",
              }}
            >
              <Crown className="w-[18px] h-[18px] text-black" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-[15px] tracking-tight leading-tight">
                {planName}
              </h3>
              <p className="text-white/40 text-xs mt-0.5">
                Renova em {formattedDate}
              </p>
            </div>
          </div>

          <div
            className="px-2.5 py-1 rounded-md"
            style={{
              background: remaining > 0
                ? "rgba(34, 197, 94, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${remaining > 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
            }}
          >
            <span
              className={`text-[11px] font-semibold ${
                remaining > 0 ? "text-green-400/90" : "text-red-400/90"
              }`}
            >
              {remaining > 0 ? `${remaining} restante${remaining > 1 ? "s" : ""}` : "Esgotado"}
            </span>
          </div>
        </div>

        {/* Usage slots */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            {slots.map((used, index) => (
              <UsageSlot key={index} used={used} index={index} total={totalAppointments} />
            ))}
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-white/40 text-xs font-medium">
              {usedAppointments} de {totalAppointments} usados
            </span>
            {/* Minimal progress bar */}
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(usedAppointments / totalAppointments) * 100}%` }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, rgba(251,191,36,0.6), rgba(251,191,36,0.3))",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06] mb-3" />

        {/* Details button */}
        <Button
          variant="ghost"
          onClick={onViewDetails}
          className="w-full h-9 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all duration-300 group text-xs"
        >
          <span className="font-medium">Ver meu plano</span>
          <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </div>
    </motion.div>
  );
}