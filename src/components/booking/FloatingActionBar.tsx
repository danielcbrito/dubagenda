import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionBarProps {
  isVisible: boolean;
  onContinue: () => void;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  className?: string;
}

export function FloatingActionBar({
  isVisible,
  onContinue,
  label,
  subtitle,
  icon,
  isLoading = false,
  loadingLabel = "Processando...",
  className
}: FloatingActionBarProps) {
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
              {/* Info row (optional) */}
              {(icon || subtitle) && (
                <div className="flex items-center gap-2.5 px-0.5">
                  {icon && icon}
                  {subtitle && (
                    <span className="text-[12px] text-muted-foreground/70">{subtitle}</span>
                  )}
                </div>
              )}

              {/* Full-width CTA */}
              <motion.button
                onClick={onContinue}
                disabled={isLoading}
                whileTap={{ scale: isLoading ? 1 : 0.985 }}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "h-[50px] rounded-xl",
                  "font-semibold text-[14px] text-primary-foreground",
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingLabel}</span>
                  </>
                ) : (
                  <>
                    <span>{label}</span>
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
