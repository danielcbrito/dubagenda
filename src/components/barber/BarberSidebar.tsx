import { Home, Calendar, DollarSign, Clock, LogOut, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface BarbeiroData {
  id: string;
  apelido: string;
  setup_completed: boolean;
  google_calendar_connected: boolean;
}

interface BarberSidebarProps {
  barbeiro: BarbeiroData;
}

const menuItems = [
  { title: "Dashboard", url: "/barbeiro", icon: Home, end: true },
  { title: "Minha Agenda", url: "/barbeiro/agenda", icon: Calendar },
  { title: "Meu Financeiro", url: "/barbeiro/financeiro", icon: DollarSign },
  { title: "Meus Horários", url: "/barbeiro/horarios", icon: Clock },
];

export function BarberSidebar({ barbeiro }: BarberSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/");
  };

  const isItemActive = (item: typeof menuItems[0]) => {
    if (item.end) return location.pathname === item.url;
    return location.pathname.startsWith(item.url);
  };

  return (
    <aside 
      className={cn(
        "group/sidebar relative h-screen flex-shrink-0 transition-all duration-500 ease-out flex flex-col",
        "backdrop-blur-[18px]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]",
        isCollapsed ? "w-[72px]" : "w-[260px]"
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(30,30,34,0.95) 0%, rgba(38,38,44,0.92) 50%, rgba(30,30,34,0.95) 100%)'
      }}
    >
      {/* Reflexo diagonal premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative py-5 px-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={logoDub} 
                  alt="DUB" 
                  className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,59,59,0.3)]" 
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-foreground">
                  {barbeiro.apelido}
                </span>
                <span className="text-[10px] text-muted-foreground/70 tracking-[0.15em] uppercase">
                  Painel Barbeiro
                </span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto">
              <img 
                src={logoDub} 
                alt="DUB" 
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,59,59,0.3)]" 
              />
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute top-[68px] -right-3 z-50 w-6 h-6 rounded-full",
          "bg-primary text-primary-foreground",
          "flex items-center justify-center",
          "shadow-lg hover:scale-110 transition-all duration-300"
        )}
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Menu */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive = isItemActive(item);
            const Icon = item.icon;
            
            return (
              <NavLink 
                key={item.title}
                to={item.url} 
                end={item.end}
                className={cn(
                  "relative h-11 rounded-xl flex items-center gap-3 px-4",
                  "text-muted-foreground/90 hover:text-foreground",
                  "bg-transparent hover:bg-white/[0.04]",
                  "transition-all duration-300",
                  isActive && "text-foreground bg-white/[0.06]",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary shadow-[0_0_12px_rgba(255,59,59,0.6)]" />
                )}
                
                <Icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-all duration-300",
                  isActive && "text-primary drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]"
                )} />
                {!isCollapsed && <span className="text-sm font-medium">{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="relative p-4">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <button
          onClick={handleLogout}
          className={cn(
            "relative flex items-center w-full px-4 py-3 rounded-xl",
            "text-muted-foreground/70 hover:text-red-400",
            "bg-transparent hover:bg-red-500/10",
            "transition-all duration-300",
            isCollapsed ? 'justify-center' : 'gap-3'
          )}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 transition-colors" />
          {!isCollapsed && <span className="text-sm font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
