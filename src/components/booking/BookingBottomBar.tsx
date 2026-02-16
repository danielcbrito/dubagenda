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
          className={cn("fixed bottom-6 left-0 right-0 z-40", className)}
        >
          <div className="relative px-4 pb-safe">
            <div 
              className="absolute -top-16 left-0 right-0 h-16 pointer-events-none"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.4) 50%, transparent)" }}
            />
            <div 
              className="absolute -bottom-4 left-4 right-4 h-10 rounded-2xl pointer-events-none"
              style={{ 
                background: "radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, transparent 70%)",
                filter: "blur(10px)"
              }}
            />
            
            <div 
              className="relative mx-auto max-w-md overflow-hidden"
              style={{
                borderRadius: "14px",
                background: "#000000",
                boxShadow: "0 8px 40px -4px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.04)",
              }}
            >
              
              <div className="flex items-center justify-between px-3.5 py-2.5">
                
                {/* Left: Summary inline */}
                <div className="flex items-center gap-2.5">
                  <div 
                    className="flex items-center justify-center w-7 h-7 rounded-lg"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))"
                    }}
                  >
                    <span className="text-[11px] font-bold text-primary">{serviceCount}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <Clock className="w-3 h-3" />
                      <span>{totalDuration}min</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">•</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] text-muted-foreground/50">R$</span>
                      <span className="text-[13px] font-semibold text-foreground tabular-nums">
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
                  className="group flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium text-[12px] text-white"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 65% 42%) 100%)",
                    boxShadow: "0 2px 8px hsl(var(--primary) / 0.3), inset 0 1px 0 rgba(255,255,255,0.12)"
                  }}
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              </div>
            </div>
            
            {/* Safe area padding */}
            <div className="h-3" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
