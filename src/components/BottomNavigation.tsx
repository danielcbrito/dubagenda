import { Home, ShoppingBag, Crown, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  showBadge?: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, isActive, showBadge, onClick }: NavItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 px-4 h-full relative transition-all duration-200 group",
        "min-w-[80px] md:min-w-[100px]",
        isActive ? "text-[#007bff]" : "text-[#333333] hover:text-[#555555]"
      )}
    >
      <div className="relative flex items-center gap-2">
        <Icon
          className={cn(
            "w-5 h-5 md:w-6 md:h-6 transition-colors duration-200",
            isActive ? "text-[#007bff]" : "text-[#333333] group-hover:text-[#555555]"
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />
        {showBadge && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-white" />
        )}
        <span
          className={cn(
            "text-[16px] md:text-[18px] transition-colors duration-200",
            isActive ? "font-bold" : "font-medium"
          )}
        >
          {label}
        </span>
      </div>
      
      {/* Indicator for active state or hover underline */}
      {isActive && (
        <motion.div 
          layoutId="nav-indicator"
          className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#007bff]"
        />
      )}
      <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#555555] opacity-0 group-hover:opacity-100 transition-opacity md:block hidden" />
    </motion.button>
  );
}

interface BottomNavigationProps {
  onProfileClick: () => void;
  onPlansClick: () => void;
  planExhausted?: boolean;
}

export function BottomNavigation({
  onProfileClick,
  onPlansClick,
  planExhausted,
}: BottomNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-[#FFFFFF] shadow-sm"
    >
      <div className="flex items-center justify-center gap-6 h-14 md:h-16 max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar">
        <NavItem
          icon={Home}
          label="Início"
          isActive={isActive("/cliente")}
          onClick={() => navigate("/cliente")}
        />
        <NavItem
          icon={ShoppingBag}
          label="Loja"
          isActive={isActive("/cliente/loja")}
          onClick={() => navigate("/cliente/loja")}
        />
        <NavItem
          icon={Crown}
          label="Planos"
          showBadge={planExhausted}
          onClick={onPlansClick}
        />
        <NavItem
          icon={User}
          label="Perfil"
          isActive={isActive("/cliente/perfil") || isActive("/cliente/dados-pessoais") || isActive("/cliente/seguranca")}
          onClick={() => navigate("/cliente/perfil")}
        />
      </div>
    </nav>
  );
}
