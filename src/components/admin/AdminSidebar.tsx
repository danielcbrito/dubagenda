import { Home, Calendar, Users, DollarSign, FileText, Gift, Sparkles, Settings, LogOut, CheckCircle } from "lucide-react";
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
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: Home, end: true },
  { title: "Agenda", url: "/admin/agenda", icon: Calendar },
  { title: "Confirmações Pendentes", url: "/admin/confirmacoes-pendentes", icon: CheckCircle },
  { title: "Clientes", url: "/admin/clientes", icon: Users },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
  { title: "Relatórios", url: "/admin/relatorios", icon: FileText },
  { title: "Planos", url: "/admin/planos", icon: Sparkles },
  { title: "Promoções", url: "/admin/promocoes", icon: Gift },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
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

    // Real-time subscription for instant updates
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

    // Fallback polling every 60 seconds
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

  return (
    <Sidebar className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <img src={logoDub} alt="DUB" className="w-10 h-10" />
          <div>
            <h2 className="font-bold text-foreground">DUB Admin</h2>
            <p className="text-xs text-muted-foreground">Painel Administrativo</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = item.end 
                  ? location.pathname === item.url
                  : location.pathname.startsWith(item.url);
                
                const isPendingPage = item.url === "/admin/confirmacoes-pendentes";
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        end={item.end}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          isActive 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </div>
                        {isPendingPage && pendingCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {pendingCount}
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
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted/50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
