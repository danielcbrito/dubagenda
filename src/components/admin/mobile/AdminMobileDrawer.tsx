import { X, Home, Calendar, Users, DollarSign, FileText, Gift, Settings, LogOut, CheckCircle, Scissors, Code, ChevronRight, HeadphonesIcon, Clock, BarChart3, CreditCard, Layers, Shield, Zap, MessageSquare, Webhook } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCount: number;
}

// Menu estruturado para mobile
const menuSections = [
  {
    label: "Principal",
    items: [
      { title: "Visão Geral", url: "/admin", icon: Home, end: true },
      { title: "Agenda", url: "/agenda-fullscreen", icon: Calendar, external: true },
      { title: "Confirmações", url: "/admin/confirmacoes-pendentes", icon: CheckCircle, badge: true },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Clientes", url: "/admin/clientes", icon: Users },
      { title: "Financeiro", url: "/admin/financeiro", icon: CreditCard },
      { title: "Relatórios", url: "/admin/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Serviços",
    items: [
      { title: "Cortes", url: "/admin/servicos/cortes", icon: Scissors },
      { title: "Planos", url: "/admin/servicos/planos", icon: Layers },
      { title: "Promoções", url: "/admin/promocoes", icon: Gift },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Horários", url: "/admin/horarios", icon: Clock },
      { title: "Suporte", url: "/admin/suporte", icon: HeadphonesIcon },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Geral", url: "/admin/suporte-config", icon: Settings },
      { title: "APIs", url: "/admin/apis", icon: Zap },
      { title: "Segurança", url: "/admin/seguranca", icon: Shield },
      { title: "Dev Tools", url: "/admin/dev", icon: Code },
    ],
  },
];

export function AdminMobileDrawer({ isOpen, onClose, pendingCount }: AdminMobileDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/");
    onClose();
  };

  const handleNavigation = (item: { url: string; external?: boolean }) => {
    if (item.external) {
      window.open(item.url, '_blank');
    } else {
      navigate(item.url);
    }
    onClose();
  };

  const isActive = (item: { url: string; end?: boolean }) => {
    if (item.end) return location.pathname === item.url;
    return location.pathname.startsWith(item.url);
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-[85%] max-w-[320px] transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div 
          className="h-full flex flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(30,30,34,0.99) 0%, rgba(26,26,30,0.99) 100%)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={logoDub} 
                  alt="DUB" 
                  className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,59,59,0.3)]" 
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-wider text-foreground">DUB</span>
                <span className="text-[10px] text-muted-foreground/70 tracking-[0.2em] uppercase font-medium">
                  Admin Panel
                </span>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-secondary/50 hover:bg-secondary",
                "border border-border/50 hover:border-primary/30",
                "transition-all duration-300 active:scale-95"
              )}
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Menu Content */}
          <ScrollArea className="flex-1 py-4">
            <div className="px-3 space-y-6">
              {menuSections.map((section) => (
                <div key={section.label}>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/40 px-3 mb-2 uppercase flex items-center gap-2">
                    <span className="w-4 h-px bg-gradient-to-r from-primary/30 to-transparent" />
                    {section.label}
                    <span className="flex-1 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                  </div>
                  
                  <nav className="space-y-1">
                    {section.items.map((item) => {
                      const active = isActive(item);
                      const hasBadge = item.badge && pendingCount > 0;
                      const Icon = item.icon;
                      
                      return (
                        <button
                          key={item.title}
                          onClick={() => handleNavigation(item)}
                          className={cn(
                            "relative w-full h-12 rounded-xl flex items-center gap-3 px-4",
                            "text-muted-foreground/90 hover:text-foreground",
                            "bg-transparent hover:bg-white/[0.04]",
                            "transition-all duration-300 ease-out",
                            "active:scale-[0.98]",
                            active && "text-foreground bg-white/[0.06]"
                          )}
                        >
                          {/* Indicador ativo lateral */}
                          {active && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary shadow-[0_0_12px_rgba(255,59,59,0.6)]" />
                          )}
                          
                          <Icon className={cn(
                            "w-5 h-5 flex-shrink-0 transition-all duration-300",
                            active && "text-primary drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]"
                          )} />
                          
                          <span className="flex-1 text-sm font-medium text-left">{item.title}</span>
                          
                          {hasBadge && (
                            <Badge 
                              className="text-[10px] h-5 px-2.5 bg-primary/15 text-primary border-0 shadow-[0_0_12px_rgba(255,59,59,0.3)] animate-pulse"
                            >
                              {pendingCount > 9 ? "9+" : pendingCount}
                            </Badge>
                          )}
                          
                          {item.external && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer - Logout */}
          <div className="p-4 border-t border-border/30">
            <button
              onClick={handleLogout}
              className={cn(
                "relative flex items-center w-full px-4 py-3.5 rounded-xl gap-3",
                "text-muted-foreground/70 hover:text-red-400",
                "bg-transparent hover:bg-red-500/10",
                "transition-all duration-300 ease-out",
                "active:scale-[0.98]"
              )}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 transition-all duration-300" />
              <span className="text-sm font-medium">Sair da conta</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
