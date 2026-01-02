import { 
  Server, 
  Database, 
  Settings, 
  Key, 
  Shield, 
  FileText, 
  Wrench, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Terminal,
  Cpu,
  Activity,
  ArrowLeft
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logoDub from "@/assets/logo-dub.png";

const menuItems = [
  { title: "Dashboard", url: "/ti", icon: Activity, end: true },
  { title: "Banco de Dados", url: "/ti/database", icon: Database },
  { title: "Configurações", url: "/ti/configuracoes", icon: Settings },
  { title: "APIs & Integrações", url: "/ti/apis", icon: Key },
  { title: "Segurança", url: "/ti/seguranca", icon: Shield },
  { title: "Logs do Sistema", url: "/ti/logs", icon: FileText },
  { title: "Manutenção", url: "/ti/manutencao", icon: Wrench },
];

export function TISidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isItemActive = (item: any) => {
    if (item.end) return location.pathname === item.url;
    return location.pathname.startsWith(item.url);
  };

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  return (
    <aside 
      className={cn(
        "group/sidebar relative h-screen flex-shrink-0 transition-all duration-500 ease-out flex flex-col",
        "backdrop-blur-[18px]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]",
        "border-r border-cyan-500/10",
        isCollapsed ? "w-[72px]" : "w-[280px]"
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,18,0.98) 0%, rgba(15,15,25,0.95) 50%, rgba(10,10,18,0.98) 100%)'
      }}
    >
      {/* Scan line effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.03) 2px, rgba(0,255,255,0.03) 4px)'
          }}
        />
      </div>

      {/* Glow border */}
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative py-5 px-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center relative z-10">
                  <Terminal className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-wider text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]">
                  DUB TI
                </span>
                <span className="text-[10px] text-cyan-500/50 tracking-[0.2em] uppercase font-medium">
                  Painel Técnico
                </span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto relative group">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute top-[72px] -right-3 z-50 w-7 h-7 rounded-full",
          "bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-600",
          "text-white",
          "flex items-center justify-center",
          "shadow-[0_4px_20px_rgba(0,255,255,0.4),0_0_30px_rgba(0,255,255,0.2)]",
          "hover:shadow-[0_4px_25px_rgba(0,255,255,0.6),0_0_40px_rgba(0,255,255,0.3)]",
          "hover:scale-110 active:scale-95",
          "transition-all duration-300 ease-out",
          "border border-white/20"
        )}
        title={isCollapsed ? "Expandir" : "Recolher"}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {/* Back to Admin Button */}
      <div className="px-3 mb-4">
        <button
          onClick={handleBackToAdmin}
          className={cn(
            "relative w-full h-10 rounded-xl flex items-center gap-3 px-4",
            "text-muted-foreground/70 hover:text-cyan-400",
            "bg-transparent hover:bg-cyan-500/10",
            "transition-all duration-300 ease-out border border-transparent hover:border-cyan-500/20",
            "group/back",
            isCollapsed && "justify-center px-0"
          )}
          title="Voltar ao Admin"
        >
          <ArrowLeft className="w-4 h-4 group-hover/back:text-cyan-400 transition-colors" />
          {!isCollapsed && <span className="text-sm">Voltar ao Admin</span>}
        </button>
      </div>

      {/* Separator */}
      {!isCollapsed && (
        <div className="px-4 mb-4">
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        </div>
      )}

      {/* Menu Content */}
      <div className="flex-1 px-3 py-2 overflow-y-auto overflow-x-hidden scrollbar-none">
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = isItemActive(item);
            const Icon = item.icon;
            
            return (
              <NavLink 
                key={item.title}
                to={item.url} 
                end={item.end}
                className={cn(
                  "relative h-12 rounded-xl flex items-center gap-3 px-4",
                  "text-muted-foreground/80 hover:text-cyan-400",
                  "bg-transparent hover:bg-cyan-500/10",
                  "transition-all duration-300 ease-out",
                  "group/item border border-transparent",
                  isActive && "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-cyan-400 shadow-[0_0_12px_rgba(0,255,255,0.6)]" />
                )}
                
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
                
                <Icon className={cn(
                  "w-5 h-5 flex-shrink-0 relative z-10 transition-all duration-300",
                  "group-hover/item:drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]",
                  isActive && "text-cyan-400 drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]"
                )} />
                {!isCollapsed && <span className="flex-1 text-sm font-medium relative z-10">{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer - System Status */}
      <div className="relative p-4">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        
        {!isCollapsed && (
          <div className="bg-cyan-500/5 rounded-xl p-3 border border-cyan-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-cyan-400 font-medium">Status do Sistema</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs text-muted-foreground">Todos os serviços online</span>
            </div>
          </div>
        )}
        
        {isCollapsed && (
          <div className="flex justify-center">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
        )}
      </div>
    </aside>
  );
}
