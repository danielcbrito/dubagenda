import { useEffect, useState, Suspense } from "react";
import { useNavigate, Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarberSidebar } from "@/components/barber/BarberSidebar";
import { BarberDashboard } from "@/components/barber/BarberDashboard";
import { BarberAgenda } from "@/components/barber/BarberAgenda";
import { BarberFinanceiro } from "@/components/barber/BarberFinanceiro";
import { BarberHorarios } from "@/components/barber/BarberHorarios";
import { BarberSetup } from "@/components/barber/BarberSetup";

interface BarbeiroData {
  id: string;
  apelido: string;
  setup_completed: boolean;
  google_calendar_connected: boolean;
}

const Barber = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [barbeiro, setBarbeiro] = useState<BarbeiroData | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

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

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#0E0E11]">
      {/* Efeitos de luz premium */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-48 -left-48 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>
      
      {/* Sidebar */}
      {!isMobile && <BarberSidebar barbeiro={barbeiro} />}
      
      {/* Conteúdo principal */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
          <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route index element={<BarberDashboard barbeiroId={barbeiro.id} />} />
                <Route path="agenda" element={<BarberAgenda barbeiroId={barbeiro.id} />} />
                <Route path="financeiro" element={<BarberFinanceiro barbeiroId={barbeiro.id} />} />
                <Route path="horarios" element={<BarberHorarios barbeiroId={barbeiro.id} />} />
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
