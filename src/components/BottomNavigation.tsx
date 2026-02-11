import { useState } from "react";
import { Home, Wallet, Headphones, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { StoreComingSoonDialog } from "./client/StoreComingSoonDialog";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  isSupport?: boolean;
}

function NavItem({ icon: Icon, label, isActive, onClick, isSupport }: NavItemProps) {
  if (isSupport) {
    return (
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-1 -mt-6"
      >
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-[10px] font-semibold text-primary">{label}</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 py-2 px-5 min-w-[72px]"
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
  onSupportClick
}: BottomNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50"
      >
        {/* Background with blur */}
        <div 
          className="absolute inset-0 backdrop-blur-xl border-t border-border/50" 
          style={{ 
            background: "linear-gradient(to top, hsl(var(--background) / 0.98), hsl(var(--card) / 0.95))",
            boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.25)" 
          }}
        />
        
        {/* Navigation Items - 4 items: Início, Loja, Suporte, Perfil */}
        <div className="relative flex items-end justify-around px-4 pb-safe max-w-lg mx-auto">
          {/* 1. Início */}
          <NavItem
            icon={Home}
            label="Início"
            isActive={isActive("/cliente")}
            onClick={() => navigate("/cliente")}
          />
          
          {/* 2. Carteira */}
          <NavItem
            icon={Wallet}
            label="Carteira"
            isActive={isActive("/cliente/carteira")}
            onClick={() => navigate("/cliente/carteira")}
          />
          
          {/* 3. Suporte (destaque central) */}
          <NavItem
            icon={Headphones}
            label="Suporte"
            isSupport
            onClick={onSupportClick}
          />
          
          {/* 4. Perfil */}
          <NavItem
            icon={User}
            label="Perfil"
            onClick={onProfileClick}
          />
        </div>
      </motion.nav>

      {/* Store Coming Soon Dialog */}
      <StoreComingSoonDialog 
        open={storeDialogOpen} 
        onOpenChange={setStoreDialogOpen}
      />
    </>
  );
}
