import { Gift, Sparkles, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface LoyaltyCardProps {
  points: number;
  redemptions: number;
  onViewDetails: () => void;
}

export function LoyaltyCard({ points, redemptions, onViewDetails }: LoyaltyCardProps) {
  const pointsProgress = (points % 5) * 20;
  const cutsUntilFree = 5 - (points % 5);
  const progressDots = Array.from({ length: 5 }, (_, i) => i < (points % 5));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg, #DC2626 0%, #EF4444 50%, #F87171 100%)",
        boxShadow: "0 20px 40px -12px rgba(220, 38, 38, 0.4), 0 8px 24px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)`,
        }}
      />

      {/* Shine effect */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          transform: "translateX(-100%)",
          animation: "shimmer 3s infinite",
        }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg tracking-tight">
                Programa de Pontos
              </h3>
              <p className="text-white/70 text-xs">
                A cada 5 cortes, ganhe 1 grátis
              </p>
            </div>
          </div>
          
          {redemptions > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.25)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 0 20px rgba(255,255,255,0.3)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              <span className="text-white text-xs font-bold">
                {redemptions} disponível
              </span>
            </motion.div>
          )}
        </div>

        {/* Progress section */}
        <div className="space-y-3 mb-4">
          {/* Progress dots */}
          <div className="flex items-center justify-between gap-2">
            {progressDots.map((filled, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex-1 h-2.5 rounded-full overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.2)",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: filled ? "100%" : "0%" }}
                  transition={{ delay: index * 0.1 + 0.2, duration: 0.4 }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #FEF08A, #FDE047)",
                    boxShadow: "0 0 12px rgba(254, 240, 138, 0.6)",
                  }}
                />
              </motion.div>
            ))}
          </div>

          {/* Progress text */}
          <div className="flex items-center justify-between text-white/80 text-xs">
            <span className="font-medium">{points % 5} de 5 cortes</span>
            <span className="flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" />
              Faltam {cutsUntilFree} para o próximo grátis
            </span>
          </div>
        </div>

        {/* View details button */}
        <Button
          variant="ghost"
          onClick={onViewDetails}
          className="w-full h-10 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all duration-300 group"
        >
          <span className="text-sm font-medium">Ver detalhes completos</span>
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
