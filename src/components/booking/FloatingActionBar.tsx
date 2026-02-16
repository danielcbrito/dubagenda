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
          <div className="pb-safe backdrop-blur-2xl" style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(10,10,12,0.7) 20%, rgba(10,10,12,0.95) 40%, #0a0a0c 60%)" }}>
            <div className="w-full px-5 pt-8 pb-5">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {icon && (
                    <div 
                      className="flex items-center justify-center w-9 h-9 rounded-xl"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))"
                      }}
                    >
                      {icon}
                    </div>
                  )}
                  
                  {subtitle && (
                    <span className="text-[13px] text-muted-foreground/70">{subtitle}</span>
                  )}
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
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{loadingLabel}</span>
                    </>
                  ) : (
                    <>
                      <span>{label}</span>
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
