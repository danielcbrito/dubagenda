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
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 relative min-w-[64px]"
    >
      <div className="relative">
        <Icon
          className={`w-[22px] h-[22px] transition-colors duration-200 ${
            isActive ? "text-primary" : "text-muted-foreground/70"
          }`}
          strokeWidth={isActive ? 2.4 : 2}
        />
        {showBadge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive border border-background shadow-sm" />
        )}
      </div>
      <span
        className={`text-[10px] tracking-tight transition-colors duration-200 ${
          isActive ? "text-primary font-bold" : "text-muted-foreground/60 font-medium"
        }`}
      >
        {label}
      </span>
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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around h-[60px] max-w-lg mx-auto">
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
