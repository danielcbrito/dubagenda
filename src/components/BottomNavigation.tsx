import { useState } from "react";
import { Home, ShoppingBag, Headphones, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { StoreComingSoonDialog } from "./client/StoreComingSoonDialog";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[64px]"
    >
      <Icon
        className={`w-5 h-5 transition-colors duration-200 ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      />
      <span
        className={`text-[10px] transition-colors duration-200 ${
          isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}

interface BottomNavigationProps {
  onProfileClick: () => void;
  onSupportClick: () => void;
}

export function BottomNavigation({
  onProfileClick,
  onSupportClick,
}: BottomNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          <NavItem
            icon={Home}
            label="Início"
            isActive={isActive("/cliente")}
            onClick={() => navigate("/cliente")}
          />
          <NavItem
            icon={ShoppingBag}
            label="Loja"
            onClick={() => setStoreDialogOpen(true)}
          />
          <NavItem
            icon={Headphones}
            label="Suporte"
            onClick={onSupportClick}
          />
          <NavItem
            icon={User}
            label="Perfil"
            onClick={onProfileClick}
          />
        </div>
      </nav>

      <StoreComingSoonDialog
        open={storeDialogOpen}
        onOpenChange={setStoreDialogOpen}
      />
    </>
  );
}
