import { Home, Calendar, Users, DollarSign, FileText, Gift, Settings, LogOut, CheckCircle, Scissors, Code, ChevronDown, ChevronRight, ChevronLeft, HeadphonesIcon, Clock, BarChart3, CreditCard, Layers, Terminal, Send } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { TIPasswordModal } from "@/components/ti/TIPasswordModal";
import { useBarbeiroLogado } from "@/hooks/useBarbeiroLogado";

// 🎨 Grupos organizados premium com gavetas
const menuGroups = [
  {
    label: "Dashboard",
    items: [
      { title: "Visão Geral", url: "/admin", icon: Home, end: true },
    ],
  },
  {
    label: "Atendimento",
    items: [
      { title: "Agenda", url: "/agenda-fullscreen", icon: Calendar, openInNewTab: true },
      { title: "Confirmações", url: "/admin/confirmacoes-pendentes", icon: CheckCircle, badge: true },
    ],
  },
  {
    label: "Pagamentos",
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
    label: "Comunicação",
    items: [
      { title: "Disparo de Mensagens", url: "/admin/disparo", icon: Send },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Horários", url: "/admin/horarios", icon: Clock },
      { title: "Suporte", url: "/admin/suporte", icon: HeadphonesIcon },
      { title: "Painel TI", url: "/ti", icon: Terminal, requiresPassword: true },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [showTIPasswordModal, setShowTIPasswordModal] = useState(false);
  
  // Hook para obter o barbeiro logado
  const { barbeiroId, loading: loadingBarbeiro } = useBarbeiroLogado();

  // Carregar contagem de pendentes - FILTRADO POR BARBEIRO
  useEffect(() => {
    if (loadingBarbeiro) return;
    
    const loadPendingCount = async () => {
      let query = supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('barbeiro_confirmou', false);
      
      // FILTRO CRÍTICO: Se o usuário é um barbeiro, contar APENAS seus agendamentos
      if (barbeiroId) {
        query = query.eq('barbeiro_id', barbeiroId);
      }
      
      const { count } = await query;
      setPendingCount(count || 0);
    };

    loadPendingCount();

    const channel = supabase
      .channel('pending-count-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos',
        },
        () => {
          loadPendingCount();
        }
      )
      .subscribe();

    const interval = setInterval(loadPendingCount, 20000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [barbeiroId, loadingBarbeiro]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/");
  };

  const isItemActive = (item: any) => {
    if (item.end) return location.pathname === item.url;
    if (item.hasSubmenu) {
      return item.submenuItems?.some((sub: any) => location.pathname === sub.url);
    }
    if (item.url) return location.pathname === item.url;
    return false;
  };

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside 
      className={cn(
        "group/sidebar relative h-screen flex-shrink-0 transition-all duration-500 ease-out flex flex-col",
        "backdrop-blur-[18px]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]",
        "border-r-0",
        isCollapsed ? "w-[72px]" : "w-[280px]"
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(30,30,34,0.95) 0%, rgba(38,38,44,0.92) 50%, rgba(30,30,34,0.95) 100%)'
      }}
    >
      {/* Reflexo diagonal premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none z-10" />
      {/* Brilho sutil na borda direita */}
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent pointer-events-none" />

      {/* Header Premium */}
      <div className="relative py-5 px-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={logoDub} 
                  alt="DUB" 
                  className="w-11 h-11 object-contain relative z-10 drop-shadow-[0_0_8px_rgba(255,59,59,0.3)] transition-transform duration-300 group-hover:scale-105" 
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#1E1E22] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-wider text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                  DUB
                </span>
                <span className="text-[10px] text-muted-foreground/70 tracking-[0.2em] uppercase font-medium">
                  Admin Panel
                </span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img 
                src={logoDub} 
                alt="DUB" 
                className="w-11 h-11 object-contain relative z-10 drop-shadow-[0_0_8px_rgba(255,59,59,0.3)] transition-transform duration-300 group-hover:scale-105" 
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#1E1E22] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button Premium */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute top-[72px] -right-3 z-50 w-7 h-7 rounded-full",
          "bg-gradient-to-br from-primary via-primary to-primary/80",
          "text-primary-foreground",
          "flex items-center justify-center",
          "shadow-[0_4px_20px_rgba(255,59,59,0.4),0_0_30px_rgba(255,59,59,0.2)]",
          "hover:shadow-[0_4px_25px_rgba(255,59,59,0.6),0_0_40px_rgba(255,59,59,0.3)]",
          "hover:scale-110 active:scale-95",
          "transition-all duration-300 ease-out",
          "border border-white/20"
        )}
        title={isCollapsed ? "Expandir" : "Recolher"}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {/* Menu Content */}
      <div className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden scrollbar-none">
        {menuGroups.map((group, groupIndex) => (
          <div
            key={group.label} 
            className="mb-5"
            style={{ animationDelay: `${groupIndex * 50}ms` }}
          >
            {!isCollapsed && (
              <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/40 px-3 mb-2.5 uppercase flex items-center gap-2">
                <span className="w-4 h-px bg-gradient-to-r from-primary/30 to-transparent" />
                {group.label}
                <span className="flex-1 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              </div>
            )}
            <nav className="space-y-1.5">
              {group.items.map((item) => {
                const isActive = isItemActive(item);
                const Icon = item.icon;
                const hasBadge = item.badge && item.url === "/admin/confirmacoes-pendentes" && pendingCount > 0;
                
                if (item.hasSubmenu) {
                  const isOpen = openMenus[item.title] ?? isActive;
                  
                  return (
                    <Collapsible key={item.title} open={!isCollapsed && isOpen} onOpenChange={() => toggleMenu(item.title)}>
                      <div>
                        <CollapsibleTrigger asChild>
                          <button 
                            className={cn(
                              "relative w-full h-12 rounded-xl flex items-center gap-3 px-4",
                              "text-muted-foreground/90 hover:text-foreground",
                              "bg-transparent hover:bg-white/[0.04]",
                              "transition-all duration-300 ease-out",
                              "group/item",
                              isActive && "text-foreground bg-white/[0.06]",
                              isCollapsed && "justify-center px-0"
                            )}
                            title={isCollapsed ? item.title : undefined}
                          >
                            {/* Glow no hover */}
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
                            
                            <Icon className={cn(
                              "w-5 h-5 flex-shrink-0 relative z-10 transition-all duration-300",
                              "group-hover/item:drop-shadow-[0_0_8px_rgba(255,59,59,0.4)]",
                              isActive && "text-primary drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]"
                            )} />
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 text-sm font-medium relative z-10 text-left">{item.title}</span>
                                <ChevronDown
                                  className={cn(
                                    "w-4 h-4 transition-all duration-300 text-muted-foreground/50 relative z-10",
                                    isOpen && 'rotate-180 text-primary/70'
                                  )}
                                />
                              </>
                            )}
                          </button>
                        </CollapsibleTrigger>
                        {!isCollapsed && (
                          <CollapsibleContent className="pl-7 mt-1.5 space-y-1">
                            {item.submenuItems?.map((subItem: any) => {
                              const subIsActive = location.pathname === subItem.url;
                              return (
                                <NavLink
                                  key={subItem.url}
                                  to={subItem.url}
                                  className={cn(
                                    "relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-300 group/sub",
                                    subIsActive 
                                      ? 'text-primary font-semibold bg-primary/10' 
                                      : 'text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.03]'
                                  )}
                                >
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                    subIsActive 
                                      ? 'bg-primary shadow-[0_0_10px_rgba(255,59,59,0.6)]' 
                                      : 'bg-muted-foreground/30 group-hover/sub:bg-primary/50'
                                  )} />
                                  {subItem.title}
                                </NavLink>
                              );
                            })}
                          </CollapsibleContent>
                        )}
                      </div>
                    </Collapsible>
                  );
                }
                
                // Painel TI com modal de senha
                if (item.requiresPassword) {
                  return (
                    <button
                      key={item.title}
                      onClick={() => setShowTIPasswordModal(true)}
                      className={cn(
                        "relative h-12 rounded-xl flex items-center gap-3 px-4 w-full text-left",
                        "text-muted-foreground/90 hover:text-foreground",
                        "bg-transparent hover:bg-white/[0.04]",
                        "transition-all duration-300 ease-out",
                        "group/item",
                        isActive && "text-foreground bg-white/[0.06]",
                        isCollapsed && "justify-center px-0"
                      )}
                      title={isCollapsed ? item.title : undefined}
                    >
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
                      <Icon className={cn(
                        "w-5 h-5 flex-shrink-0 relative z-10 transition-all duration-300",
                        "group-hover/item:drop-shadow-[0_0_8px_rgba(255,59,59,0.4)]",
                        isActive && "text-primary drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]"
                      )} />
                      {!isCollapsed && <span className="flex-1 text-sm font-medium relative z-10">{item.title}</span>}
                    </button>
                  );
                }

                if (item.openInNewTab) {
                  return (
                    <a
                      key={item.title}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "relative h-12 rounded-xl flex items-center gap-3 px-4",
                        "text-muted-foreground/90 hover:text-foreground",
                        "bg-transparent hover:bg-white/[0.04]",
                        "transition-all duration-300 ease-out",
                        "group/item",
                        isActive && "text-foreground bg-white/[0.06]",
                        isCollapsed && "justify-center px-0"
                      )}
                      title={isCollapsed ? item.title : undefined}
                    >
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
                      <Icon className={cn(
                        "w-5 h-5 flex-shrink-0 relative z-10 transition-all duration-300",
                        "group-hover/item:drop-shadow-[0_0_8px_rgba(255,59,59,0.4)]",
                        isActive && "text-primary drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]"
                      )} />
                      {!isCollapsed && <span className="flex-1 text-sm font-medium relative z-10">{item.title}</span>}
                    </a>
                  );
                }
                
                return (
                  <NavLink 
                    key={item.title}
                    to={item.url!} 
                    end={item.end}
                    className={cn(
                      "relative h-12 rounded-xl flex items-center gap-3 px-4",
                      "text-muted-foreground/90 hover:text-foreground",
                      "bg-transparent hover:bg-white/[0.04]",
                      "transition-all duration-300 ease-out",
                      "group/item",
                      isActive && "text-foreground bg-white/[0.06]",
                      isCollapsed && "justify-center px-0"
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    {/* Indicador ativo lateral */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary shadow-[0_0_12px_rgba(255,59,59,0.6)]" />
                    )}
                    
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
                    
                    <Icon className={cn(
                      "w-5 h-5 flex-shrink-0 relative z-10 transition-all duration-300",
                      "group-hover/item:drop-shadow-[0_0_8px_rgba(255,59,59,0.4)]",
                      isActive && "text-primary drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]"
                    )} />
                    {!isCollapsed && <span className="flex-1 text-sm font-medium relative z-10">{item.title}</span>}
                    {hasBadge && !isCollapsed && (
                      <Badge 
                        className="ml-auto text-[10px] h-5 px-2.5 bg-primary/15 text-primary border-0 shadow-[0_0_12px_rgba(255,59,59,0.3)] animate-pulse relative z-10"
                      >
                        {pendingCount > 9 ? "9+" : pendingCount}
                      </Badge>
                    )}
                    {hasBadge && isCollapsed && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,59,59,0.6)]" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="relative p-4">
        {/* Separador gradiente sutil */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <button
          onClick={handleLogout}
          className={cn(
            "relative flex items-center w-full px-4 py-3.5 rounded-xl",
            "text-muted-foreground/70 hover:text-red-400",
            "bg-transparent hover:bg-red-500/10",
            "transition-all duration-300 ease-out",
            "group/logout",
            isCollapsed ? 'justify-center' : 'gap-3'
          )}
          title={isCollapsed ? "Sair" : undefined}
        >
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover/logout:opacity-100 transition-opacity duration-300" />
          <LogOut className="w-5 h-5 flex-shrink-0 relative z-10 transition-all duration-300 group-hover/logout:drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          {!isCollapsed && <span className="text-sm font-medium relative z-10">Sair do Sistema</span>}
        </button>
      </div>

      {/* Modal de senha para Painel TI */}
      <TIPasswordModal
        isOpen={showTIPasswordModal}
        onSuccess={() => {
          setShowTIPasswordModal(false);
          navigate("/ti");
        }}
        onCancel={() => setShowTIPasswordModal(false)}
      />
    </aside>
  );
}
