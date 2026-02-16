import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSelectionBarProps {
  selectedDate: Date | null;
  selectedTime: string;
  formattedDate: string;
  onContinue: () => void;
  isVisible: boolean;
  isLoading?: boolean;
  className?: string;
}

export function TimeSelectionBar({
  selectedDate,
  selectedTime,
  formattedDate,
  onContinue,
  isVisible,
  isLoading = false,
  className
}: TimeSelectionBarProps) {
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
            <div className="w-full px-5 pt-8 pb-5">
              
              <div className="flex items-center justify-between">
                
                <div className="flex items-center gap-3">
                  <div 
                    className="flex items-center justify-center w-9 h-9 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))"
                    }}
                  >
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-foreground tabular-nums">{selectedTime}</span>
                    <span className="text-[11px] text-muted-foreground/50">•</span>
                    <span className="text-[13px] text-muted-foreground/70">{formattedDate}</span>
                  </div>
                </div>

                {/* Right: CTA Button */}
                <motion.button
                  onClick={onContinue}
                  disabled={isLoading}
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.95 }}
                  className={cn(
                    "group flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[14px] text-white",
                    isLoading && "cursor-wait opacity-70"
                  )}
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 65% 42%) 100%)",
                    boxShadow: "0 2px 8px hsl(var(--primary) / 0.3), inset 0 1px 0 rgba(255,255,255,0.12)"
                  }}
                >
                  {isLoading ? (
                    <>
                      <motion.div 
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <>
                      <span>Continuar</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
