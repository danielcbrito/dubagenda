import { useEffect, Suspense, useState } from "react";
import { useNavigate, Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileHeader } from "@/components/admin/mobile/AdminMobileHeader";
import { AdminMobileNavigation } from "@/components/admin/mobile/AdminMobileNavigation";
import { AdminMobileDrawer } from "@/components/admin/mobile/AdminMobileDrawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminAgenda } from "@/components/admin/AdminAgenda";
import { AdminClientes } from "@/components/admin/AdminClientes";
import { AdminFinanceiro } from "@/components/admin/AdminFinanceiro";
import { AdminRelatorios } from "@/components/admin/AdminRelatorios";
import { AdminPromocoes } from "@/components/admin/AdminPromocoes";
import { AdminServicos } from "@/components/admin/AdminServicos";
import { AdminAPIs } from "@/components/admin/AdminAPIs";
import { AdminSeguranca } from "@/components/admin/AdminSeguranca";
import { AdminConfiguracoes } from "@/components/admin/AdminConfiguracoes";
import { AdminConfirmacoesPendentes } from "@/components/admin/AdminConfirmacoesPendentes";
import { AdminDev } from "@/components/admin/AdminDev";
import { AdminSuportePanel } from "@/components/admin/AdminSuportePanel";
import { AdminSuporteConfig } from "@/components/admin/AdminSuporteConfig";
import AdminHorarios from "@/components/admin/AdminHorarios";
import { AdminDisparo } from "@/components/admin/AdminDisparo";

// Mapeamento de rotas para títulos
const routeTitles: Record<string, string> = {
  "/admin": "Visão Geral",
  "/admin/agenda": "Agenda",
  "/admin/confirmacoes-pendentes": "Confirmações",
  "/admin/clientes": "Clientes",
  "/admin/financeiro": "Financeiro",
  "/admin/relatorios": "Relatórios",
  "/admin/servicos/cortes": "Cortes",
  "/admin/servicos/planos": "Planos",
  "/admin/promocoes": "Promoções",
  "/admin/suporte": "Suporte",
  "/admin/suporte-config": "Configurações",
  "/admin/configuracoes": "Configurações",
  "/admin/apis": "APIs",
  "/admin/seguranca": "Segurança",
  "/admin/horarios": "Horários",
  "/admin/dev": "Dev Tools",
  "/admin/disparo": "Disparo de Mensagens",
};

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Carregar contagem de pendentes
  useEffect(() => {
    const loadPendingCount = async () => {
      const { count } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('barbeiro_confirmou', false);
      
      setPendingCount(count || 0);
    };

    loadPendingCount();

    const channel = supabase
      .channel('admin-pending-count')
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      toast.error("Acesso não autorizado");
      navigate("/cliente");
      return;
    }
  };

  // Obter título da rota atual
  const getCurrentTitle = () => {
    // Verificar correspondência exata primeiro
    if (routeTitles[location.pathname]) {
      return routeTitles[location.pathname];
    }
    // Verificar se começa com alguma rota conhecida
    for (const [path, title] of Object.entries(routeTitles)) {
      if (location.pathname.startsWith(path) && path !== "/admin") {
        return title;
      }
    }
    return "Visão Geral";
  };

  const handleOpenDrawer = () => setIsDrawerOpen(true);
  const handleCloseDrawer = () => setIsDrawerOpen(false);

  // Layout Loading
  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    </div>
  );

  // ========== LAYOUT MOBILE ==========
  if (isMobile) {
    return (
      <div className="relative min-h-screen w-full bg-[#0E0E11]">
        {/* Efeitos de luz premium no fundo */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute -top-32 -right-32 w-[300px] h-[300px] bg-primary/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -bottom-48 -left-48 w-[250px] h-[250px] bg-primary/10 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        </div>

        {/* Header Mobile */}
        <AdminMobileHeader 
          onMenuClick={handleOpenDrawer}
          pendingCount={pendingCount}
          currentTitle={getCurrentTitle()}
        />

        {/* Drawer Menu */}
        <AdminMobileDrawer 
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          pendingCount={pendingCount}
        />

        {/* Conteúdo Principal */}
        <main className="relative z-10 pb-24">
          <div className="p-4">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route index element={<AdminDashboard />} />
                <Route path="agenda" element={<AdminAgenda />} />
                <Route path="confirmacoes-pendentes" element={<AdminConfirmacoesPendentes />} />
                <Route path="clientes" element={<AdminClientes />} />
                <Route path="financeiro" element={<AdminFinanceiro />} />
                <Route path="relatorios" element={<AdminRelatorios />} />
                <Route path="servicos/*" element={<AdminServicos />} />
                <Route path="promocoes" element={<AdminPromocoes />} />
                <Route path="suporte" element={<AdminSuportePanel />} />
                <Route path="suporte-config" element={<AdminSuporteConfig />} />
                <Route path="configuracoes" element={<AdminConfiguracoes />} />
                <Route path="apis" element={<AdminAPIs />} />
                <Route path="seguranca" element={<AdminSeguranca />} />
                <Route path="horarios" element={<AdminHorarios />} />
                <Route path="dev" element={<AdminDev />} />
              </Routes>
            </Suspense>
          </div>
        </main>

        {/* Bottom Navigation Mobile */}
        <AdminMobileNavigation 
          pendingCount={pendingCount}
          onSettingsClick={handleOpenDrawer}
        />
      </div>
    );
  }

  // ========== LAYOUT DESKTOP ==========
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#0E0E11]">
        {/* Efeitos de luz premium no fundo */}
        <div className="pointer-events-none fixed inset-0 z-0">
          {/* Luz vermelha principal - canto superior direito */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
          
          {/* Luz vermelha secundária - canto inferior esquerdo */}
          <div className="absolute -bottom-48 -left-48 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
          
          {/* Pontinhos de luz vermelha dispersos */}
          <div className="absolute top-[20%] left-[30%] w-2 h-2 bg-primary/40 rounded-full blur-sm animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute top-[40%] right-[25%] w-1.5 h-1.5 bg-primary/30 rounded-full blur-sm animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          <div className="absolute bottom-[30%] left-[45%] w-2.5 h-2.5 bg-primary/35 rounded-full blur-sm animate-pulse" style={{ animationDuration: '5s', animationDelay: '0.5s' }} />
          <div className="absolute top-[60%] right-[40%] w-1 h-1 bg-primary/25 rounded-full blur-sm animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '2s' }} />
          <div className="absolute bottom-[15%] right-[15%] w-2 h-2 bg-primary/30 rounded-full blur-sm animate-pulse" style={{ animationDuration: '4.5s', animationDelay: '1.5s' }} />
          
          {/* Gradiente sutil de profundidade */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20" />
        </div>
        
        {/* Sidebar fixa à esquerda */}
        <AdminSidebar />
        
        {/* Conteúdo principal */}
        <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300">
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
            <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="agenda" element={<AdminAgenda />} />
                  <Route path="confirmacoes-pendentes" element={<AdminConfirmacoesPendentes />} />
                  <Route path="clientes" element={<AdminClientes />} />
                  <Route path="financeiro" element={<AdminFinanceiro />} />
                  <Route path="relatorios" element={<AdminRelatorios />} />
                  <Route path="servicos/*" element={<AdminServicos />} />
                  <Route path="promocoes" element={<AdminPromocoes />} />
                  <Route path="suporte" element={<AdminSuportePanel />} />
                  <Route path="suporte-config" element={<AdminSuporteConfig />} />
                  <Route path="configuracoes" element={<AdminConfiguracoes />} />
                  <Route path="apis" element={<AdminAPIs />} />
                  <Route path="seguranca" element={<AdminSeguranca />} />
                  <Route path="horarios" element={<AdminHorarios />} />
                  <Route path="dev" element={<AdminDev />} />
                  <Route path="disparo" element={<AdminDisparo />} />
                </Routes>
              </Suspense>
            </div>
          </div>
      </main>
    </div>
  );
};

export default Admin;
