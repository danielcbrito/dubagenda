import { User, Gift, Calendar, Trophy, HeadphonesIcon, Wallet, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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
      isCenter: true, // Centro destacado
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
      {/* Glassmorphism background */}
      <div className="backdrop-blur-xl bg-background/80 border-t border-border/30">
        <div className="max-w-4xl mx-auto px-2">
          <div className="flex items-end justify-around py-2">
            {navItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-300 group",
                  item.isCenter 
                    ? "relative -mt-6" 
                    : "px-3 py-2"
                )}
              >
                {item.isCenter ? (
                  // Centro destacado - Suporte IA
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-primary/40 rounded-full blur-xl animate-pulse" />
                    
                    {/* Button container */}
                    <div className="relative w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-red group-hover:scale-110 transition-transform duration-300">
                      <item.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    
                    {/* Label */}
                    <span className="text-[10px] font-medium text-primary mt-1.5 block text-center">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  // Items normais
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-all duration-300">
                      <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                    </div>
                    <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-300 mt-0.5">
                      {item.label}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
