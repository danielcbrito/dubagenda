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
            style={{ background: "linear-gradient(to bottom, transparent, #FBFBFA)" }}
          />

          {/* Bar content */}
          <div className="bg-[#FBFBFA] px-5 pb-safe">
            <div className="pt-4 pb-5 space-y-3">
              {/* Info row (optional) */}
              {(icon || subtitle) && (
                <div className="flex items-center gap-2.5 px-0.5">
                  {icon && icon}
                  {subtitle && (
                    <span className="text-[13px] font-medium text-neutral-600">{subtitle}</span>
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
                  "h-[54px] rounded-full",
                  "font-medium text-[15px] tracking-wide text-white",
                  "bg-neutral-900",
                  "active:scale-[0.98] transition-all duration-300",
                  isLoading && "opacity-70 cursor-wait"
                )}
                style={{
                  boxShadow: "0 8px 30px rgba(0,0,0,0.12)"
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingLabel}</span>
                  </>
                ) : (
                  <span>{label}</span>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
