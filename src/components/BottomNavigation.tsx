import { Home, Store, Crown, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="relative flex flex-1 flex-col items-center justify-start gap-1 px-1 pt-1.5 pb-1"
    >
      <Icon
        className={`h-[26px] w-[26px] transition-all duration-200 ${
          isActive ? "text-primary" : "text-muted-foreground/50"
        }`}
        strokeWidth={isActive ? 2.2 : 1.5}
      />
      <span
        className={`text-[10px] leading-none tracking-wide transition-colors duration-200 ${
          isActive ? "font-medium text-primary" : "font-normal text-muted-foreground/50"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}

/** Fixed 4-tab bottom navigation for the client app. */
export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border/30 bg-background/95 backdrop-blur-md"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex h-11 w-full items-stretch justify-around">


        <NavItem
          icon={Home}
          label="Início"
          isActive={isActive("/cliente")}
          onClick={() => navigate("/cliente")}
        />
        <NavItem
          icon={Store}
          label="Loja"
          isActive={isActive("/cliente/loja")}
          onClick={() => navigate("/cliente/loja")}
        />
        <NavItem
          icon={Crown}
          label="Plano"
          isActive={isActive("/cliente/assinar")}
          onClick={() => navigate("/cliente/assinar")}
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
