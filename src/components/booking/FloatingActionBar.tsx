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
          <div className="relative px-4 pb-safe">
            {/* Fade gradient */}
            <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            
            {/* Compact floating bar */}
            <div 
              className="relative mx-auto max-w-md"
              style={{
                borderRadius: "16px",
                background: "rgba(18, 18, 20, 0.95)",
                boxShadow: `
                  0 0 0 1px rgba(255, 255, 255, 0.08),
                  0 8px 32px -8px rgba(0, 0, 0, 0.6),
                  0 4px 16px -4px rgba(239, 68, 68, 0.1)
                `,
                backdropFilter: "blur(20px)"
              }}
            >
              {/* Subtle top accent */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.5), transparent)"
                }}
              />
              
              <div className="flex items-center justify-between px-4 py-3">
                {/* Left: Icon + info */}
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
                    <div>
                      <p className="text-[11px] text-muted-foreground/60 leading-tight">{subtitle}</p>
                    </div>
                  )}
                </div>

                {/* Right: CTA Button */}
                <motion.button
                  onClick={onContinue}
                  disabled={isLoading}
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                  className={cn(
                    "group flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white",
                    isLoading && "cursor-wait opacity-70"
                  )}
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 65% 42%) 100%)",
                    boxShadow: "0 2px 12px hsl(var(--primary) / 0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
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
            
            <div className="h-3" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
