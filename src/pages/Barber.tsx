import { useEffect, useState, Suspense } from "react";
import { useNavigate, Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarberSidebar } from "@/components/barber/BarberSidebar";
import { BarberMobileHeader } from "@/components/barber/mobile/BarberMobileHeader";
import { BarberMobileNavigation } from "@/components/barber/mobile/BarberMobileNavigation";
import { BarberMobileDrawer } from "@/components/barber/mobile/BarberMobileDrawer";
import { BarberDashboard } from "@/components/barber/BarberDashboard";
import { BarberAgenda } from "@/components/barber/BarberAgenda";
import { BarberFinanceiro } from "@/components/barber/BarberFinanceiro";
import { BarberHorarios } from "@/components/barber/BarberHorarios";
import { BarberSetup } from "@/components/barber/BarberSetup";
import { BarberConfirmacoes } from "@/components/barber/BarberConfirmacoes";
import { BarberServicos } from "@/components/barber/BarberServicos";
import { BarberPromocoes } from "@/components/barber/BarberPromocoes";
import { BarberRelatorios } from "@/components/barber/BarberRelatorios";
import { BarberPerfil } from "@/components/barber/BarberPerfil";
import { BarberGoogleCalendar } from "@/components/barber/BarberGoogleCalendar";

interface BarbeiroData {
  id: string;
  apelido: string;
  setup_completed: boolean;
  google_calendar_connected: boolean;
}

// Mapeamento de rotas para títulos
const routeTitles: Record<string, string> = {
  "/barbeiro": "Visão Geral",
  "/barbeiro/agenda": "Agenda",
  "/barbeiro/confirmacoes": "Confirmações",
  "/barbeiro/financeiro": "Financeiro",
  "/barbeiro/relatorios": "Relatórios",
  "/barbeiro/servicos": "Cortes",
  "/barbeiro/promocoes": "Promoções",
  "/barbeiro/horarios": "Meus Horários",
  "/barbeiro/perfil": "Perfil",
  "/barbeiro/google-calendar": "Google Calendar",
  "/barbeiro/setup": "Configuração",
};

const Barber = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [barbeiro, setBarbeiro] = useState<BarbeiroData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  // Carregar contagem de pendentes
  useEffect(() => {
    if (!barbeiro?.id) return;

    const loadPendingCount = async () => {
      const { count } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('barbeiro_id', barbeiro.id)
        .eq('status', 'pending')
        .eq('barbeiro_confirmou', false);
      
      setPendingCount(count || 0);
    };

    loadPendingCount();

    const channel = supabase
      .channel('barber-page-pending-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos',
          filter: `barbeiro_id=eq.${barbeiro.id}`,
        },
        () => {
          loadPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbeiro?.id]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Verificar se é barbeiro
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "barber");

      if (!roles || roles.length === 0) {
        // Não é barbeiro, verificar se é admin
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin");

        if (adminRoles && adminRoles.length > 0) {
          navigate("/admin");
        } else {
          navigate("/cliente");
        }
        return;
      }

      // Buscar dados do barbeiro
      const { data: barbeiroData, error } = await supabase
        .from("barbeiros")
        .select("id, apelido, setup_completed, google_calendar_connected")
        .eq("user_id", session.user.id)
        .single();

      if (error || !barbeiroData) {
        toast.error("Erro ao carregar dados do barbeiro");
        navigate("/auth");
        return;
      }

      setBarbeiro(barbeiroData);

      // Se não completou setup, redirecionar
      if (!barbeiroData.setup_completed && location.pathname !== "/barbeiro/setup") {
        navigate("/barbeiro/setup");
      }
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  // Obter título da rota atual
  const getCurrentTitle = () => {
    if (routeTitles[location.pathname]) {
      return routeTitles[location.pathname];
    }
    for (const [path, title] of Object.entries(routeTitles)) {
      if (location.pathname.startsWith(path) && path !== "/barbeiro") {
        return title;
      }
    }
    return "Visão Geral";
  };

  const handleOpenDrawer = () => setIsDrawerOpen(true);
  const handleCloseDrawer = () => setIsDrawerOpen(false);

  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0E0E11]">
        <LoadingFallback />
      </div>
    );
  }

  if (!barbeiro) {
    return null;
  }

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
        <BarberMobileHeader 
          onMenuClick={handleOpenDrawer}
          pendingCount={pendingCount}
          currentTitle={getCurrentTitle()}
          barbeiroNome={barbeiro.apelido}
        />

        {/* Drawer Menu */}
        <BarberMobileDrawer 
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          pendingCount={pendingCount}
          barbeiro={barbeiro}
        />

        {/* Conteúdo Principal */}
        <main className="relative z-10 pb-24">
          <div className="p-4">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route index element={<BarberDashboard barbeiroId={barbeiro.id} />} />
                <Route path="agenda" element={<BarberAgenda barbeiroId={barbeiro.id} />} />
                <Route path="confirmacoes" element={<BarberConfirmacoes barbeiroId={barbeiro.id} />} />
                <Route path="financeiro" element={<BarberFinanceiro barbeiroId={barbeiro.id} />} />
                <Route path="relatorios" element={<BarberRelatorios barbeiroId={barbeiro.id} />} />
                <Route path="servicos" element={<BarberServicos />} />
                <Route path="promocoes" element={<BarberPromocoes />} />
                <Route path="horarios" element={<BarberHorarios barbeiroId={barbeiro.id} />} />
                <Route path="perfil" element={<BarberPerfil barbeiroId={barbeiro.id} />} />
                <Route path="google-calendar" element={<BarberGoogleCalendar barbeiroId={barbeiro.id} />} />
                <Route path="setup" element={<BarberSetup barbeiroId={barbeiro.id} onComplete={() => {
                  setBarbeiro(prev => prev ? { ...prev, setup_completed: true } : null);
                  navigate("/barbeiro");
                }} />} />
              </Routes>
            </Suspense>
          </div>
        </main>

        {/* Bottom Navigation Mobile */}
        <BarberMobileNavigation 
          pendingCount={pendingCount}
          onSettingsClick={handleOpenDrawer}
        />
      </div>
    );
  }

  // ========== LAYOUT DESKTOP ==========
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#0E0E11]">
      {/* Efeitos de luz premium */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-48 -left-48 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-[20%] left-[30%] w-2 h-2 bg-primary/40 rounded-full blur-sm animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute top-[40%] right-[25%] w-1.5 h-1.5 bg-primary/30 rounded-full blur-sm animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <div className="absolute bottom-[30%] left-[45%] w-2.5 h-2.5 bg-primary/35 rounded-full blur-sm animate-pulse" style={{ animationDuration: '5s', animationDelay: '0.5s' }} />
      </div>
      
      {/* Sidebar */}
      <BarberSidebar barbeiro={barbeiro} />
      
      {/* Conteúdo principal */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
          <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route index element={<BarberDashboard barbeiroId={barbeiro.id} />} />
                <Route path="agenda" element={<BarberAgenda barbeiroId={barbeiro.id} />} />
                <Route path="confirmacoes" element={<BarberConfirmacoes barbeiroId={barbeiro.id} />} />
                <Route path="financeiro" element={<BarberFinanceiro barbeiroId={barbeiro.id} />} />
                <Route path="relatorios" element={<BarberRelatorios barbeiroId={barbeiro.id} />} />
                <Route path="servicos" element={<BarberServicos />} />
                <Route path="promocoes" element={<BarberPromocoes />} />
                <Route path="horarios" element={<BarberHorarios barbeiroId={barbeiro.id} />} />
                <Route path="perfil" element={<BarberPerfil barbeiroId={barbeiro.id} />} />
                <Route path="google-calendar" element={<BarberGoogleCalendar barbeiroId={barbeiro.id} />} />
                <Route path="setup" element={<BarberSetup barbeiroId={barbeiro.id} onComplete={() => {
                  setBarbeiro(prev => prev ? { ...prev, setup_completed: true } : null);
                  navigate("/barbeiro");
                }} />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Barber;
