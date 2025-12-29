import { Home, Calendar, CheckCircle, DollarSign, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BarberMobileNavigationProps {
  pendingCount?: number;
  onSettingsClick?: () => void;
}

export function BarberMobileNavigation({ 
  pendingCount = 0,
  onSettingsClick 
}: BarberMobileNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      icon: Home,
      label: "Início",
      path: "/barbeiro",
      exact: true,
    },
    {
      icon: Calendar,
      label: "Agenda",
      path: "/agenda-fullscreen",
      external: true,
    },
    {
      icon: CheckCircle,
      label: "Confirmar",
      path: "/barbeiro/confirmacoes",
      badge: pendingCount,
      isCenter: true,
    },
    {
      icon: DollarSign,
      label: "Financeiro",
      path: "/barbeiro/financeiro",
    },
    {
      icon: Settings,
      label: "Config",
      onClick: onSettingsClick,
    },
  ];

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return location.pathname === item.path;
    if (item.path) return location.pathname.startsWith(item.path);
    return false;
  };

  const handleClick = (item: typeof navItems[0]) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.external) {
      window.open(item.path, '_blank');
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div 
        className="backdrop-blur-xl border-t border-border/30"
        style={{
          background: 'linear-gradient(0deg, rgba(30,30,34,0.98) 0%, rgba(30,30,34,0.92) 100%)'
        }}
      >
        <div className="flex items-end justify-around py-2 px-2">
          {navItems.map((item, index) => {
            const active = isActive(item);
            const hasBadge = item.badge && item.badge > 0;
            
            return (
              <button
                key={index}
                onClick={() => handleClick(item)}
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-300 group min-w-[60px]",
                  item.isCenter ? "relative -mt-4" : "px-2 py-2"
                )}
              >
                {item.isCenter ? (
                  <div className="relative">
                    {hasBadge && (
                      <div className="absolute inset-0 bg-primary/40 rounded-full blur-xl animate-pulse" />
                    )}
                    
                    <div className={cn(
                      "relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                      hasBadge 
                        ? "bg-gradient-to-br from-primary to-primary/80 shadow-glow-red" 
                        : "bg-secondary border border-border/50",
                      "group-hover:scale-110 group-active:scale-95"
                    )}>
                      <item.icon className={cn(
                        "w-6 h-6",
                        hasBadge ? "text-primary-foreground" : "text-foreground"
                      )} />
                      
                      {hasBadge && (
                        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center shadow-lg">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </div>
                    
                    <span className={cn(
                      "text-[10px] font-medium mt-1.5 block text-center",
                      hasBadge ? "text-primary" : "text-muted-foreground"
                    )}>
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                      active 
                        ? "bg-primary/15 text-primary" 
                        : "text-muted-foreground group-hover:bg-secondary group-hover:text-foreground"
                    )}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className={cn(
                      "text-[9px] font-medium transition-colors duration-300 mt-0.5",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}>
                      {item.label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
