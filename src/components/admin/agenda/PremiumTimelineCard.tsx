import { memo } from "react";
import { motion } from "framer-motion";
import { 
  Clock, 
  User, 
  Scissors, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimelineAppointment } from "../AdminAgenda";

interface PremiumTimelineCardProps {
  appointment: TimelineAppointment;
  timeStatus: "now" | "soon" | "passed" | "future";
  onClick: () => void;
  index: number;
}

const serviceIcons: Record<string, typeof Scissors> = {
  corte: Scissors,
  barba: Scissors,
  combo: Scissors,
  sobrancelha: Scissors,
  pezinho: Scissors,
};

const getServiceColor = (serviceName: string | undefined) => {
  if (!serviceName) return { bg: "bg-zinc-500/20", text: "text-zinc-400", glow: "rgba(113, 113, 122, 0.3)" };
  
  const name = serviceName.toLowerCase();
  if (name.includes("corte")) return { bg: "bg-sky-500/20", text: "text-sky-400", glow: "rgba(56, 189, 248, 0.3)" };
  if (name.includes("barba")) return { bg: "bg-amber-500/20", text: "text-amber-400", glow: "rgba(245, 158, 11, 0.3)" };
  if (name.includes("combo")) return { bg: "bg-violet-500/20", text: "text-violet-400", glow: "rgba(139, 92, 246, 0.3)" };
  if (name.includes("sobrancelha")) return { bg: "bg-rose-500/20", text: "text-rose-400", glow: "rgba(244, 63, 94, 0.3)" };
  return { bg: "bg-primary/20", text: "text-primary", glow: "rgba(212, 49, 49, 0.3)" };
};

export const PremiumTimelineCard = memo(function PremiumTimelineCard({
  appointment,
  timeStatus,
  onClick,
  index
}: PremiumTimelineCardProps) {
  const serviceColor = getServiceColor(appointment.servico?.nome);
  const ServiceIcon = Scissors;
  
  const payment = appointment.pagamentos?.[0];
  const isPaid = payment?.status === "paid";
  const isPaidWithCredit = appointment.payment_method === 'credit' || appointment.observacoes?.includes('crédito do app');
  const isPlanAppointment = appointment.tipo_agendamento === 'plano' || appointment.payment_method === 'plano';

  const getTimeStatusConfig = () => {
    switch (timeStatus) {
      case "now":
        return {
          borderColor: "border-l-emerald-500",
          bgColor: "bg-emerald-500/5",
          badge: { text: "AGORA", bg: "bg-emerald-500", animate: true }
        };
      case "soon":
        return {
          borderColor: "border-l-amber-500",
          bgColor: "bg-amber-500/5",
          badge: { text: "EM BREVE", bg: "bg-amber-500", animate: false }
        };
      case "passed":
        return appointment.status === "completed" 
          ? {
              borderColor: "border-l-sky-500",
              bgColor: "bg-sky-500/5",
              badge: null
            }
          : {
              borderColor: "border-l-red-500",
              bgColor: "bg-red-500/5",
              badge: { text: "ATRASADO", bg: "bg-red-500", animate: true }
            };
      default:
        return {
          borderColor: "border-l-white/10",
          bgColor: "",
          badge: null
        };
    }
  };

  const statusConfig = getTimeStatusConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2, ease: "easeOut" }}
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border-l-[3px] cursor-pointer",
        "transition-all duration-300 ease-out",
        "hover:translate-y-[-2px]",
        statusConfig.borderColor,
        statusConfig.bgColor
      )}
      style={{
        background: "linear-gradient(135deg, rgba(24, 24, 29, 0.6), rgba(18, 18, 22, 0.8))",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.2)"
      }}
    >
      {/* Glow effect on hover */}
      <div 
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `0 0 30px ${serviceColor.glow}` }}
      />

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Time and Service Icon */}
          <div className="flex items-start gap-3">
            {/* Service Icon */}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              serviceColor.bg
            )}>
              <ServiceIcon className={cn("w-5 h-5", serviceColor.text)} />
            </div>

            {/* Main Info */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-foreground">
                  {appointment.servico?.nome || "Serviço"}
                </span>
                
                {/* Duration Badge */}
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-white/5 text-muted-foreground">
                  <Timer className="w-3 h-3 inline mr-1" />
                  {appointment.servico?.duracao_minutos || 30}min
                </span>

                {/* Status Badge */}
                {statusConfig.badge && (
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded-md text-white uppercase tracking-wider",
                    statusConfig.badge.bg,
                    statusConfig.badge.animate && "animate-pulse"
                  )}>
                    {statusConfig.badge.text}
                  </span>
                )}
              </div>

              {/* Client Name */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{appointment.profile?.nome || "Cliente"}</span>
              </div>
            </div>
          </div>

          {/* Right: Time and Actions */}
          <div className="flex flex-col items-end gap-2">
            {/* Time */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className={cn(
                "text-sm font-semibold tabular-nums",
                timeStatus === "now" && "text-emerald-400",
                timeStatus === "soon" && "text-amber-400"
              )}>
                {appointment.hora.substring(0, 5)}
              </span>
            </div>

            {/* Payment Status */}
            <div className="flex items-center gap-2">
              {isPlanAppointment ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
                  📋 PLANO
                </span>
              ) : isPaidWithCredit ? (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-400">
                  <CreditCard className="w-3 h-3 inline mr-1" />
                  CRÉDITO APP
                </span>
              ) : appointment.is_free ? (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-gradient-to-r from-violet-500/20 to-pink-500/20 text-violet-400">
                  CORTESIA
                </span>
              ) : (
                <>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md",
                    isPaid 
                      ? "bg-emerald-500/20 text-emerald-400" 
                      : "bg-amber-500/20 text-amber-400"
                  )}>
                    {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {isPaid ? "PAGO" : "PENDENTE"}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    R$ {appointment.preco.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* More Actions Button */}
        <button 
          className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </motion.div>
  );
});