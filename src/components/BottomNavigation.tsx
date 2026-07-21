import { Home, Calendar, User } from "lucide-react";
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
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative flex min-w-[64px] flex-col items-center justify-center gap-1 px-3 py-1.5"
    >
      <Icon
        className={`h-[22px] w-[22px] transition-colors duration-200 ${
          isActive ? "text-primary" : "text-muted-foreground/70"
        }`}
        strokeWidth={isActive ? 2.4 : 2}
      />
      <span
        className={`text-[10px] tracking-tight transition-colors duration-200 ${
          isActive ? "font-bold text-primary" : "font-medium text-muted-foreground/60"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}

/** Fixed 3-tab bottom navigation for the client app. */
export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border/60 bg-white"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex h-[60px] max-w-lg items-center justify-around">
        <NavItem
          icon={Home}
          label="Início"
          isActive={isActive("/cliente")}
          onClick={() => navigate("/cliente")}
        />
        <NavItem
          icon={Calendar}
          label="Agendar"
          isActive={isActive("/cliente/agendar")}
          onClick={() => navigate("/cliente/agendar")}
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
