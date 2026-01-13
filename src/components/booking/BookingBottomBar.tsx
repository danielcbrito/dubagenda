import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowRight, Sparkles } from "lucide-react";
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
            stiffness: 400, 
            damping: 35,
            mass: 0.8
          }}
          className={cn("fixed bottom-0 left-0 right-0 z-40", className)}
        >
          {/* Premium floating container */}
          <div className="relative px-4 pb-safe">
            {/* Fade gradient for seamless blend */}
            <div className="absolute -top-16 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
            
            {/* Main floating bar */}
            <div 
              className="relative mx-auto max-w-lg overflow-hidden"
              style={{
                borderRadius: "20px",
                background: "linear-gradient(135deg, rgba(20, 20, 22, 0.95) 0%, rgba(28, 28, 32, 0.98) 100%)",
                boxShadow: `
                  0 0 0 1px rgba(255, 255, 255, 0.06),
                  0 4px 24px -4px rgba(0, 0, 0, 0.5),
                  0 12px 48px -8px rgba(239, 68, 68, 0.15),
                  inset 0 1px 0 rgba(255, 255, 255, 0.04)
                `,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)"
              }}
            >
              {/* Subtle red glow accent at top */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px"
                style={{
                  background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), transparent)"
                }}
              />
              
              {/* Content container */}
              <div className="relative px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  
                  {/* Left section: Service info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Premium service count badge */}
                    <div 
                      className="relative flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl"
                      style={{
                        background: "linear-gradient(145deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 8px hsl(var(--primary) / 0.1)"
                      }}
                    >
                      <span className="text-lg font-bold text-primary">
                        {serviceCount}
                      </span>
                      {/* Sparkle accent */}
                      <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-primary/60" />
                    </div>
                    
                    {/* Info text */}
                    <div className="min-w-0 flex-1">
                      {/* Labels row */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-1">
                        <span>{serviceCount === 1 ? 'serviço' : 'serviços'}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <Clock className="w-3 h-3" />
                        <span>{totalDuration} min</span>
                      </div>
                      
                      {/* Price - prominent display */}
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-medium text-muted-foreground/60">R$</span>
                        <span className="text-xl font-bold text-foreground tracking-tight">
                          {totalPrice.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right section: CTA Button */}
                  <motion.button
                    onClick={onContinue}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative group flex items-center gap-2.5 px-6 py-3 rounded-2xl font-semibold text-white overflow-hidden flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 70% 45%) 100%)",
                      boxShadow: `
                        0 2px 12px hsl(var(--primary) / 0.4),
                        0 4px 24px hsl(var(--primary) / 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                      `
                    }}
                  >
                    {/* Animated shine effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 btn-shine-effect" />
                    
                    <span className="relative z-10 text-[15px]">Continuar</span>
                    <ArrowRight className="relative z-10 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </motion.button>
                </div>
              </div>
            </div>
            
            {/* Bottom padding for safe area */}
            <div className="h-4" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
