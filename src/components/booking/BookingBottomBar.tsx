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
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={cn("fixed bottom-0 left-0 right-0 z-40", className)}
        >
          {/* Subtle top fade */}
          <div 
            className="h-16 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
          />

          {/* Bar content */}
          <div className="bg-background border-t border-border/40 px-5 pb-safe">
            <div className="pt-3.5 pb-4 space-y-3">
              {/* Info row */}
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-primary tabular-nums">{serviceCount}</span>
                    <span className="text-[11px] text-muted-foreground/60">
                      {serviceCount === 1 ? 'serviço' : 'serviços'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <Clock className="w-3 h-3" />
                    <span className="tabular-nums">{totalDuration}min</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-muted-foreground/50 font-medium">R$</span>
                  <span className="text-[17px] font-bold text-foreground tabular-nums tracking-tight">
                    {totalPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Full-width CTA */}
              <motion.button
                onClick={onContinue}
                whileTap={{ scale: 0.985 }}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "h-[50px] rounded-xl",
                  "font-semibold text-[14px] text-primary-foreground",
                  "bg-primary",
                  "active:brightness-90 transition-all duration-150"
                )}
                style={{
                  boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)"
                }}
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
