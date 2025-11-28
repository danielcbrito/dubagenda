import { Home, Calendar, Users, DollarSign, FileText, Gift, Settings, LogOut, CheckCircle, Scissors, Code, MessageSquare, ChevronDown } from "lucide-react";
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

// 🎨 Grupos organizados premium
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
      { title: "Serviços", url: "/admin/servicos", icon: Scissors, hasSubmenu: true },
      { title: "Promoções", url: "/admin/promocoes", icon: Gift },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
      { title: "Dev Tools", url: "/admin/dev", icon: Code },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

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
    if (item.hasSubmenu) return location.pathname.startsWith(item.url);
    return location.pathname === item.url;
  };

  return (
    <Sidebar className="sidebar-glass">
      <SidebarHeader className="border-b border-border/50 p-6 backdrop-blur-[12px]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-red">
            <img src={logoDub} alt="DUB" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground tracking-widest">DUB</h2>
            <p className="text-xs text-muted-foreground tracking-wider">PREMIUM ADMIN</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6">
        {menuGroups.map((group, groupIndex) => (
          <SidebarGroup key={group.label} className="mb-6">
            <SidebarGroupLabel className="px-4 mb-3 text-xs font-bold text-muted-foreground tracking-widest uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isItemActive(item);
                  const Icon = item.icon;
                  const hasBadge = item.badge && item.url === "/admin/confirmacoes-pendentes" && pendingCount > 0;
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="p-0">
                        <NavLink 
                          to={item.url} 
                          end={item.end}
                          className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                              isActive 
                                ? 'bg-gradient-primary shadow-glow-red' 
                                : 'bg-secondary/50'
                            }`}>
                              <Icon className="w-5 h-5" strokeWidth={2.5} />
                            </div>
                            <span className="text-sm font-semibold">{item.title}</span>
                          </div>
                          {hasBadge && (
                            <Badge 
                              variant="destructive" 
                              className="ml-auto bg-primary shadow-glow-red font-bold"
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

      <SidebarFooter className="border-t border-border/50 p-6 backdrop-blur-[12px]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-4 w-full px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all border border-transparent hover:border-border-glow hover:shadow-glow-red"
        >
          <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
            <LogOut className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold">Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
