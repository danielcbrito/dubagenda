import { User, Gift, Trophy, HeadphonesIcon, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BottomNavigationProps {
  onProfileClick: () => void;
  onPlansClick: () => void;
  onPointsClick: () => void;
  onWalletClick: () => void;
  onHistoryClick: () => void;
}

export function BottomNavigation({
  onProfileClick,
  onPlansClick,
  onPointsClick,
  onWalletClick,
  onHistoryClick,
}: BottomNavigationProps) {
  const navigate = useNavigate();

  const handleSupport = () => {
    navigate("/suporte");
  };

  const navItems = [
    {
      icon: User,
      label: "Perfil",
      onClick: onProfileClick,
      isCenter: false,
    },
    {
      icon: Wallet,
      label: "Carteira",
      onClick: onWalletClick,
      isCenter: false,
    },
    {
      icon: HeadphonesIcon,
      label: "Suporte",
      onClick: handleSupport,
      isCenter: true,
    },
    {
      icon: Gift,
      label: "Planos",
      onClick: onPlansClick,
      isCenter: false,
    },
    {
      icon: Trophy,
      label: "Pontos",
      onClick: onPointsClick,
      isCenter: false,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      {/* Premium glassmorphism container */}
      <div 
        className="relative"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 10, 10, 0.6) 0%, rgba(15, 15, 15, 0.95) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        {/* Top border glow */}
        <div 
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(217, 65, 65, 0.3) 20%, rgba(217, 65, 65, 0.5) 50%, rgba(217, 65, 65, 0.3) 80%, transparent 100%)',
          }}
        />
        
        {/* Subtle inner glow */}
        <div 
          className="absolute inset-x-0 top-0 h-12 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)',
          }}
        />

        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-end justify-between py-2 relative">
            {navItems.map((item, index) => (
              <motion.button
                key={index}
                onClick={item.onClick}
                whileTap={{ scale: 0.92 }}
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-300 group relative",
                  item.isCenter 
                    ? "relative -mt-7 z-10" 
                    : "flex-1 py-2"
                )}
              >
                {item.isCenter ? (
                  // Centro destacado - Suporte Premium
                  <div className="relative flex flex-col items-center">
                    {/* Outer glow ring - pulsing */}
                    <div 
                      className="absolute -inset-2 rounded-full animate-pulse opacity-60"
                      style={{
                        background: 'radial-gradient(circle, rgba(217, 65, 65, 0.4) 0%, transparent 70%)',
                      }}
                    />
                    
                    {/* Secondary glow */}
                    <div 
                      className="absolute -inset-1 rounded-full blur-md"
                      style={{
                        background: 'linear-gradient(135deg, rgba(217, 65, 65, 0.5) 0%, rgba(180, 50, 50, 0.3) 100%)',
                      }}
                    />
                    
                    {/* Main button */}
                    <motion.div 
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                      className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300"
                      style={{
                        background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0, 65%, 40%) 100%)',
                        boxShadow: '0 8px 32px rgba(217, 65, 65, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      {/* Inner highlight */}
                      <div 
                        className="absolute inset-0.5 rounded-full opacity-20"
                        style={{
                          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%)',
                        }}
                      />
                      <item.icon className="w-6 h-6 text-white relative z-10" strokeWidth={2.2} />
                    </motion.div>
                    
                    {/* Label */}
                    <span 
                      className="text-[10px] font-semibold mt-2 tracking-wide"
                      style={{ color: 'hsl(var(--primary))' }}
                    >
                      {item.label}
                    </span>
                  </div>
                ) : (
                  // Items normais - Premium style
                  <div className="flex flex-col items-center gap-1 relative">
                    {/* Hover background */}
                    <div 
                      className="absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: 'radial-gradient(circle, rgba(217, 65, 65, 0.08) 0%, transparent 70%)',
                      }}
                    />
                    
                    {/* Icon container */}
                    <div 
                      className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {/* Hover glow */}
                      <div 
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: 'linear-gradient(135deg, rgba(217, 65, 65, 0.1) 0%, transparent 100%)',
                          border: '1px solid rgba(217, 65, 65, 0.2)',
                        }}
                      />
                      
                      <item.icon 
                        className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300 relative z-10" 
                        strokeWidth={1.8}
                      />
                    </div>
                    
                    {/* Label */}
                    <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-300 tracking-wide">
                      {item.label}
                    </span>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
        
        {/* Bottom safe area fill */}
        <div 
          className="h-safe"
          style={{
            background: 'rgba(15, 15, 15, 0.95)',
          }}
        />
      </div>
    </div>
  );
}
