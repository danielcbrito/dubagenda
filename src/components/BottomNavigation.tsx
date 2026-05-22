import { Home, ShoppingBag, Crown, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

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
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 px-4 py-2 relative min-w-[72px]"
    >
      <div className="relative">
        <Icon
          className={`w-6 h-6 transition-all duration-300 ${
            isActive ? "text-primary scale-110" : "text-muted-foreground/70"
          }`}
          strokeWidth={isActive ? 2.5 : 2}
        />
        {showBadge && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background animate-pulse" />
        )}
      </div>
      <span
        className={`text-xs tracking-tight transition-all duration-300 ${
          isActive ? "text-primary font-bold" : "text-muted-foreground/60 font-medium"
        }`}
      >
        {label}
      </span>
      {isActive && (
        <motion.div
          layoutId="nav-active"
          className="absolute -top-2 inset-x-4 h-1 bg-primary rounded-full"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.2)]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around h-[72px] max-w-lg mx-auto px-4">
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
          isActive={isActive("/cliente/perfil")}
          onClick={() => navigate("/cliente/perfil")}
        />
      </div>
    </nav>
  );
}
