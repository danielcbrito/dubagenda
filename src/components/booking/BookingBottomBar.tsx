import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingBottomBarProps {
  serviceCount: number;
  totalDuration: number;
  totalPrice: number;
  onContinue: () => void;
  isVisible: boolean;
  className?: string;
}

export function BookingBottomBar({
  serviceCount,
  totalDuration,
  totalPrice,
  onContinue,
  isVisible,
  className
}: BookingBottomBarProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 500, 
            damping: 40
          }}
          className={cn("fixed bottom-0 left-0 right-0 z-40", className)}
        >
          <div className="pb-safe" style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.85) 35%, #000000 55%)" }}>
            <div className="w-full px-5 pt-12 pb-5">
              
              <div className="flex items-center justify-between">
                
                {/* Left: Summary inline */}
                <div className="flex items-center gap-3">
                  <div 
                    className="flex items-center justify-center w-9 h-9 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))"
                    }}
                  >
                    <span className="text-[12px] font-bold text-primary">{serviceCount}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[12px] text-muted-foreground/70">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{totalDuration}min</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">•</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] text-muted-foreground/60">R$</span>
                      <span className="text-[14px] font-semibold text-foreground tabular-nums">
                        {totalPrice.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: CTA Button */}
                <motion.button
                  onClick={onContinue}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  className="group flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-[13px] text-white"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 65% 42%) 100%)",
                    boxShadow: "0 2px 8px hsl(var(--primary) / 0.3), inset 0 1px 0 rgba(255,255,255,0.12)"
                  }}
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
