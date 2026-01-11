import { useState } from "react";
import { Home, User, Headphones, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

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
        className="flex flex-col items-center justify-center gap-1 -mt-5"
      >
        <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span className="text-[10px] font-medium text-red-500">{label}</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 py-2 px-4 min-w-[60px]"
    >
      <Icon 
        className={`w-5 h-5 transition-colors ${
          isActive ? "text-red-500" : "text-zinc-500"
        }`} 
      />
      <span 
        className={`text-[10px] transition-colors ${
          isActive ? "text-red-500 font-semibold" : "text-zinc-500 font-medium"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}

interface BottomNavigationProps {
  onProfileClick: () => void;
  onMenuClick: () => void;
  onSupportClick: () => void;
}

export function BottomNavigation({ 
  onProfileClick,
  onMenuClick,
  onSupportClick
}: BottomNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Background with blur */}
      <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800" 
        style={{ boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.1)" }}
      />
      
      {/* Navigation Items */}
      <div className="relative flex items-end justify-around px-2 pb-safe max-w-lg mx-auto">
        <NavItem
          icon={Home}
          label="Início"
          isActive={isActive("/cliente")}
          onClick={() => navigate("/cliente")}
        />
        
        <NavItem
          icon={User}
          label="Perfil"
          onClick={onProfileClick}
        />
        
        <NavItem
          icon={Headphones}
          label="Suporte"
          isSupport
          onClick={onSupportClick}
        />
        
        <NavItem
          icon={Menu}
          label="Menu"
          onClick={onMenuClick}
        />
      </div>
    </motion.nav>
  );
}
