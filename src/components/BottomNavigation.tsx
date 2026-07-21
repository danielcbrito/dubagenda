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
      className="relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2"
    >
      <Icon
        className={`h-[22px] w-[22px] transition-colors duration-200 ${
          isActive ? "text-foreground" : "text-muted-foreground/60"
        }`}
        strokeWidth={isActive ? 2.2 : 1.6}
      />
      <span
        className={`text-[10px] leading-none tracking-tight transition-colors duration-200 ${
          isActive ? "font-semibold text-foreground" : "font-normal text-muted-foreground/60"
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
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border/40 bg-background"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex h-14 w-full items-stretch justify-around">


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
