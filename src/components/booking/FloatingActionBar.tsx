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
                {/* Left: Icon + info inline */}
                <div className="flex items-center gap-2.5">
                  {icon && (
                    <div 
                      className="flex items-center justify-center w-7 h-7 rounded-lg"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))"
                      }}
                    >
                      {icon}
                    </div>
                  )}
                  
                  {subtitle && (
                    <span className="text-[11px] text-muted-foreground/60">{subtitle}</span>
                  )}
                </div>

                {/* Right: CTA Button */}
                <motion.button
                  onClick={onContinue}
                  disabled={isLoading}
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.95 }}
                  className={cn(
                    "group flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium text-[12px] text-white",
                    isLoading && "cursor-wait opacity-70"
                  )}
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 65% 42%) 100%)",
                    boxShadow: "0 2px 8px hsl(var(--primary) / 0.3), inset 0 1px 0 rgba(255,255,255,0.12)"
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{loadingLabel}</span>
                    </>
                  ) : (
                    <>
                      <span>{label}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
