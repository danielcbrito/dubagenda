import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, ArrowRight, CheckCircle2 } from "lucide-react";
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
                  
                  {/* Left section: Time info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Time icon with glow */}
                    <div 
                      className="relative flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl"
                      style={{
                        background: "linear-gradient(145deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 8px hsl(var(--primary) / 0.1)"
                      }}
                    >
                      <Clock className="w-5 h-5 text-primary" />
                      {/* Check badge */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    
                    {/* Time details */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground/70 mb-1">
                        Horário confirmado
                      </p>
                      
                      {/* Time and date display */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-foreground">
                          {selectedTime}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span className="text-sm text-muted-foreground/80">
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right section: CTA Button */}
                  <motion.button
                    onClick={onContinue}
                    disabled={isLoading}
                    whileHover={{ scale: isLoading ? 1 : 1.02 }}
                    whileTap={{ scale: isLoading ? 1 : 0.98 }}
                    className={cn(
                      "relative group flex items-center gap-2.5 px-6 py-3 rounded-2xl font-semibold text-white overflow-hidden flex-shrink-0",
                      isLoading && "cursor-wait"
                    )}
                    style={{
                      background: isLoading 
                        ? "linear-gradient(135deg, hsl(var(--primary) / 0.6) 0%, hsl(0 70% 45% / 0.6) 100%)"
                        : "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 70% 45%) 100%)",
                      boxShadow: isLoading 
                        ? "0 2px 8px hsl(var(--primary) / 0.2)"
                        : `
                            0 2px 12px hsl(var(--primary) / 0.4),
                            0 4px 24px hsl(var(--primary) / 0.2),
                            inset 0 1px 0 rgba(255, 255, 255, 0.2),
                            inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                          `
                    }}
                  >
                    {/* Animated shine effect */}
                    {!isLoading && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 btn-shine-effect" />
                    )}
                    
                    {isLoading ? (
                      <>
                        <motion.div 
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span className="relative z-10 text-[15px]">Verificando...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative z-10 text-[15px]">Continuar</span>
                        <ArrowRight className="relative z-10 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </>
                    )}
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
