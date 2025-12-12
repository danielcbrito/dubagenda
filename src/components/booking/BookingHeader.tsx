import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface BookingHeaderProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  onBack: () => void;
}

export const BookingHeader = ({ currentStep, totalSteps, title, onBack }: BookingHeaderProps) => {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0"
    >
      {/* Glassmorphism header */}
      <div 
        className="px-4 py-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(18, 18, 18, 0.95) 0%, rgba(10, 10, 10, 0.9) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(197, 164, 109, 0.1)',
        }}
      >
        {/* Subtle top shine */}
        <div 
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 10%, rgba(197, 164, 109, 0.3) 50%, transparent 90%)'
          }}
        />
        
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-4 mb-5">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              className="h-11 w-11 rounded-2xl transition-all duration-300 hover:scale-105"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(197, 164, 109, 0.15)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
              }}
            >
              <ArrowLeft className="w-5 h-5 text-[#C5A46D]" />
            </Button>
            <h1 
              className="font-bold text-xl tracking-tight"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                background: 'linear-gradient(135deg, #ffffff 0%, #C5A46D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {title}
            </h1>
          </div>
          
          {/* Premium progress bar */}
          <div className="relative">
            {/* Track */}
            <div 
              className="h-1.5 rounded-full overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              {/* Progress */}
              <motion.div 
                className="h-full rounded-full relative"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                  background: 'linear-gradient(90deg, #8B1E25 0%, #C5A46D 100%)',
                  boxShadow: '0 0 20px rgba(197, 164, 109, 0.5)'
                }}
              >
                {/* Shine effect */}
                <div 
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)'
                  }}
                />
              </motion.div>
            </div>
            
            {/* Step indicators */}
            <div className="flex justify-between mt-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div 
                  key={i}
                  className="text-xs font-medium transition-colors duration-300"
                  style={{
                    color: i + 1 <= currentStep ? '#C5A46D' : 'rgba(255,255,255,0.3)'
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
