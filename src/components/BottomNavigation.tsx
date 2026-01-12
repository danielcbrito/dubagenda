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
        <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span className="text-[10px] font-semibold text-red-500">{label}</span>
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
          isActive ? "text-red-500" : "text-zinc-400"
        }`} 
      />
      <span 
        className={`text-[10px] transition-colors duration-200 ${
          isActive ? "text-red-500 font-semibold" : "text-zinc-400 font-medium"
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
          className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800" 
          style={{ boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.08)" }}
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
          
          {/* 2. Loja */}
          <NavItem
            icon={ShoppingBag}
            label="Loja"
            onClick={() => setStoreDialogOpen(true)}
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
