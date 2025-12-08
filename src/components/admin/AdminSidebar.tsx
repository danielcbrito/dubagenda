import { Home, Calendar, Users, DollarSign, FileText, Gift, Settings, LogOut, CheckCircle, Scissors, Code, ChevronDown, ChevronRight, ChevronLeft, HeadphonesIcon, Clock, BarChart3, CreditCard, Layers } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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
    label: "Sistema",
    items: [
      { title: "Horários", url: "/admin/horarios", icon: Clock },
      { title: "Suporte", url: "/admin/suporte", icon: HeadphonesIcon },
      { 
        title: "Configurações", 
        icon: Settings, 
        hasSubmenu: true,
        submenuItems: [
          { title: "Geral", url: "/admin/suporte-config" },
          { title: "APIs", url: "/admin/apis" },
          { title: "Segurança", url: "/admin/seguranca" },
          { title: "Dev Tools", url: "/admin/dev" },
        ]
      },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadPendingCount = async () => {
      const { count } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed'])
        .eq('barbeiro_confirmou', false);
      
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
  }, []);

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
    <Sidebar 
      className={cn(
        "sidebar-premium border-r-0 overflow-y-auto transition-all duration-300 ease-out",
        isCollapsed ? "w-[72px]" : "w-[280px]"
      )}
    >
      {/* Header */}
      <SidebarHeader className="border-b border-border/30 py-4 px-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={logoDub} alt="DUB" className="w-10 h-10 object-contain" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-wide text-foreground">DUB</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">Admin Panel</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto relative">
              <img src={logoDub} alt="DUB" className="w-10 h-10 object-contain" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute top-20 -right-3 z-50 w-6 h-6 rounded-full",
          "bg-primary text-primary-foreground",
          "flex items-center justify-center",
          "shadow-lg hover:scale-110 transition-transform",
          "border-2 border-background"
        )}
        title={isCollapsed ? "Expandir" : "Recolher"}
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <SidebarContent className="px-3 py-4" style={{ overflowX: 'hidden' }}>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label} className="mb-4">
            {!isCollapsed && (
              <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/50 px-3 mb-2 uppercase">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isItemActive(item);
                  const Icon = item.icon;
                  const hasBadge = item.badge && item.url === "/admin/confirmacoes-pendentes" && pendingCount > 0;
                  
                  if (item.hasSubmenu) {
                    const isOpen = openMenus[item.title] ?? isActive;
                    
                    return (
                      <Collapsible key={item.title} open={!isCollapsed && isOpen} onOpenChange={() => toggleMenu(item.title)}>
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton 
                              className={cn(
                                "sidebar-menu-item h-11",
                                isActive && "active",
                                isCollapsed && "justify-center px-0"
                              )}
                              title={isCollapsed ? item.title : undefined}
                            >
                              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
                              {!isCollapsed && (
                                <>
                                  <span className="flex-1 text-sm font-medium">{item.title}</span>
                                  <ChevronDown
                                    className={cn(
                                      "w-4 h-4 transition-transform duration-200 text-muted-foreground",
                                      isOpen && 'rotate-180'
                                    )}
                                  />
                                </>
                              )}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          {!isCollapsed && (
                            <CollapsibleContent className="pl-6 mt-1 space-y-0.5">
                              {item.submenuItems?.map((subItem: any) => {
                                const subIsActive = location.pathname === subItem.url;
                                return (
                                  <SidebarMenuButton 
                                    key={subItem.url} 
                                    asChild 
                                    className="p-0"
                                  >
                                    <NavLink
                                      to={subItem.url}
                                      className={cn(
                                        "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all",
                                        subIsActive 
                                          ? 'text-primary font-semibold bg-primary/10 border border-primary/20' 
                                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                      )}
                                    >
                                      <div className={cn(
                                        "w-1.5 h-1.5 rounded-full transition-colors",
                                        subIsActive ? 'bg-primary shadow-[0_0_8px_rgba(255,59,59,0.5)]' : 'bg-muted-foreground/50'
                                      )} />
                                      {subItem.title}
                                    </NavLink>
                                  </SidebarMenuButton>
                                );
                              })}
                            </CollapsibleContent>
                          )}
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="p-0">
                        {item.openInNewTab ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "sidebar-menu-item h-11",
                              isActive && 'active',
                              isCollapsed && "justify-center px-0"
                            )}
                            title={isCollapsed ? item.title : undefined}
                          >
                            <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
                            {!isCollapsed && <span className="flex-1 text-sm font-medium">{item.title}</span>}
                          </a>
                        ) : (
                          <NavLink 
                            to={item.url} 
                            end={item.end}
                            className={cn(
                              "sidebar-menu-item h-11",
                              isActive && 'active',
                              isCollapsed && "justify-center px-0"
                            )}
                            title={isCollapsed ? item.title : undefined}
                          >
                            <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
                            {!isCollapsed && <span className="flex-1 text-sm font-medium">{item.title}</span>}
                            {hasBadge && !isCollapsed && (
                              <Badge 
                                className="ml-auto text-[10px] h-5 px-2 bg-primary/20 text-primary border border-primary/30 animate-pulse"
                              >
                                {pendingCount > 9 ? "9+" : pendingCount}
                              </Badge>
                            )}
                            {hasBadge && isCollapsed && (
                              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                            )}
                          </NavLink>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/30 p-4">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center w-full px-4 py-3 rounded-xl",
            "text-muted-foreground hover:text-destructive",
            "bg-transparent hover:bg-destructive/10",
            "border border-transparent hover:border-destructive/20",
            "transition-all duration-200",
            isCollapsed ? 'justify-center' : 'gap-3'
          )}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Sair do Sistema</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
