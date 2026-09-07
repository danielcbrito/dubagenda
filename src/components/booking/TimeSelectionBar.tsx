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
          <div className="bg-background px-5 pb-safe">
            <div className="pt-3.5 pb-4 space-y-3">
              {/* Info row */}
              <div className="flex items-center gap-2.5 px-0.5">
                <Check className="w-4 h-4 text-success flex-shrink-0" />
                <span className="text-[15px] font-medium text-foreground tabular-nums">{selectedTime}</span>
                <span className="text-[10px] text-muted-foreground/40">•</span>
                <span className="text-[12px] text-muted-foreground/70">{formattedDate}</span>
              </div>

              {/* Full-width CTA */}
              <motion.button
                onClick={onContinue}
                disabled={isLoading}
                whileTap={{ scale: isLoading ? 1 : 0.985 }}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "h-[50px] rounded-xl",
                  "font-medium text-[15px] text-primary-foreground",
                  "bg-primary",
                  "active:brightness-90 transition-all duration-150",
                  isLoading && "opacity-70 cursor-wait"
                )}
                style={{
                  boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)"
                }}
              >
                {isLoading ? (
                  <>
                    <motion.div 
                      className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
