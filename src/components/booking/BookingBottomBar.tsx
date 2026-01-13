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
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            mass: 0.8
          }}
          className={cn("fixed bottom-0 left-0 right-0 z-40", className)}
        >
          {/* Glassmorphism container */}
          <div className="relative">
            {/* Gradient overlay top edge */}
            <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
            
            {/* Main container with glassmorphism */}
            <div 
              className="relative backdrop-blur-2xl"
              style={{
                background: "linear-gradient(180deg, hsl(var(--card) / 0.95) 0%, hsl(var(--card) / 0.98) 100%)",
                borderTop: "1px solid hsl(var(--border) / 0.5)",
                boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.3), 0 -2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
              }}
            >
              {/* Subtle top highlight line */}
              <div 
                className="absolute top-0 left-6 right-6 h-px"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.3) 50%, transparent 100%)"
                }}
              />

              <div className="max-w-2xl mx-auto px-5 py-4 pb-safe">
                <div className="flex items-center gap-4">
                  
                  {/* Left: Info section with subtle background */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {/* Service count indicator */}
                      <div 
                        className="flex items-center justify-center w-10 h-10 rounded-xl"
                        style={{
                          background: "linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.05) 100%)",
                          border: "1px solid hsl(var(--primary) / 0.2)"
                        }}
                      >
                        <span className="text-sm font-bold text-primary">
                          {serviceCount}
                        </span>
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-muted-foreground">
                            {serviceCount === 1 ? 'serviço' : 'serviços'}
                          </span>
                          <span className="text-muted-foreground/30">•</span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {totalDuration} min
                            </span>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <span className="text-xl font-bold text-foreground tracking-tight">
                            {totalPrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Continue button with gradient */}
                  <motion.button
                    onClick={onContinue}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative group flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-primary-foreground overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)",
                      boxShadow: "0 4px 16px hsl(var(--primary) / 0.3), 0 2px 4px hsl(var(--primary) / 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
                    }}
                  >
                    {/* Shine effect on hover */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)",
                        transform: "translateX(-100%)",
                        animation: "shine 1.5s ease-in-out infinite"
                      }}
                    />
                    
                    <span className="relative z-10">Continuar</span>
                    <ArrowRight className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
