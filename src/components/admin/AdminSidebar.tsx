import { Home, Calendar, Users, DollarSign, FileText, Gift, Settings, LogOut, CheckCircle, Scissors, Code, Menu, ChevronDown, ChevronRight, ShieldCheck, Key } from "lucide-react";
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
      { title: "Agenda", url: "/admin/agenda", icon: Calendar },
      { title: "Confirmações", url: "/admin/confirmacoes-pendentes", icon: CheckCircle, badge: true },
    ],
  },
  {
    label: "Pagamentos",
    items: [
      { title: "Clientes", url: "/admin/clientes", icon: Users },
      { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
      { title: "Relatórios", url: "/admin/relatorios", icon: FileText },
    ],
  },
  {
    label: "Administração",
    items: [
      { 
        title: "Serviços", 
        icon: Scissors, 
        hasSubmenu: true,
        submenuItems: [
          { title: "Cortes", url: "/admin/servicos/cortes" },
          { title: "Planos", url: "/admin/servicos/planos" },
        ]
      },
      { title: "Promoções", url: "/admin/promocoes", icon: Gift },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
      { title: "APIs & Integrações", url: "/admin/apis", icon: Key },
      { title: "Segurança", url: "/admin/seguranca", icon: ShieldCheck },
      { title: "Dev Tools", url: "/admin/dev", icon: Code },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'Atendimento': true, // Default open
  });

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
      className="sidebar-glass border-r-0"
      style={{ 
        width: isCollapsed ? '64px' : '260px',
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <SidebarHeader className="border-b border-border/50 py-3 px-3">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <img src={logoDub} alt="DUB" className="w-8 h-8 object-contain" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-wide text-primary">DUB</span>
                <span className="text-[9px] text-muted-foreground">Admin Panel</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <img src={logoDub} alt="DUB" className="w-8 h-8 object-contain mx-auto" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 hover:bg-secondary/50 shrink-0"
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3" style={{ overflowX: 'hidden' }}>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label} className="mb-3">
            {!isCollapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-wider text-muted-foreground/60 px-3 mb-1.5">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
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
                              className={`sidebar-menu-item h-10 ${isActive ? 'active' : ''}`}
                              title={isCollapsed ? item.title : undefined}
                            >
                              <Icon className="w-5 h-5 flex-shrink-0" />
                              {!isCollapsed && (
                                <>
                                  <span className="flex-1 text-sm">{item.title}</span>
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                      isOpen ? 'rotate-180' : ''
                                    }`}
                                  />
                                </>
                              )}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          {!isCollapsed && (
                            <CollapsibleContent className="pl-5 mt-0.5 space-y-0.5">
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
                                      className={`flex items-center gap-3 px-4 py-2 rounded-lg text-xs transition-all ${
                                        subIsActive 
                                          ? 'text-primary font-semibold bg-primary/10' 
                                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                      }`}
                                    >
                                      <div className={`w-1.5 h-1.5 rounded-full ${
                                        subIsActive ? 'bg-primary' : 'bg-muted-foreground'
                                      }`} />
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
                        <NavLink 
                          to={item.url} 
                          end={item.end}
                          className={`sidebar-menu-item h-10 ${isActive ? 'active' : ''}`}
                          title={isCollapsed ? item.title : undefined}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          {!isCollapsed && <span className="flex-1 text-sm">{item.title}</span>}
                          {hasBadge && !isCollapsed && (
                            <Badge 
                              variant="destructive" 
                              className="ml-auto text-[10px] h-4 px-1.5"
                            >
                              {pendingCount > 9 ? "9+" : pendingCount}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3">
        <button
          onClick={handleLogout}
          className={`flex items-center w-full px-3 py-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ${
            isCollapsed ? 'justify-center' : 'gap-3'
          }`}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
