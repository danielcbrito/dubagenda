import { useEffect, Suspense, useState } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { TISidebar } from "@/components/ti/TISidebar";
import { TIDashboard } from "@/components/ti/TIDashboard";
import { TIClientes } from "@/components/ti/TIClientes";
import { TIWebhooks } from "@/components/ti/TIWebhooks";
import { TIConfiguracoes } from "@/components/ti/TIConfiguracoes";
import { TILogs } from "@/components/ti/TILogs";
import { TIManutencao } from "@/components/ti/TIManutencao";
import { TIDispositivos } from "@/components/ti/TIDispositivos";
import { TISenha } from "@/components/ti/TISenha";
import { TIPasswordModal } from "@/components/ti/TIPasswordModal";

const TI = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Verificação de manutenção
  const { 
    isMaintenanceMode, 
    maintenanceMessage, 
    isLoading: maintenanceLoading, 
    isAllowedUser 
  } = useMaintenanceMode();

  useEffect(() => {
    checkAuth();
  }, []);

  // Verificar se já está autenticado no TI
  useEffect(() => {
    const tiAuth = sessionStorage.getItem('ti_authenticated');
    if (tiAuth === 'true') {
      setIsAuthenticated(true);
    } else {
      setShowPasswordModal(true);
    }
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

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
    
    setAuthChecked(true);
  };

  const handlePasswordSuccess = () => {
    setShowPasswordModal(false);
    setIsAuthenticated(true);
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    navigate("/admin");
  };

  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

  // Loading state enquanto verifica auth e manutenção
  if (maintenanceLoading || !authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0d12]">
        <LoadingFallback />
      </div>
    );
  }

  // Modal de senha
  if (showPasswordModal || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0d12]">
        <TIPasswordModal
          isOpen={true}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
        />
      </div>
    );
  }

  // Se está em manutenção e o usuário NÃO está na lista de permitidos
  if (isMaintenanceMode && !isAllowedUser) {
    return (
      <MaintenanceScreen 
        message={maintenanceMessage || undefined}
        onExit={() => navigate("/")}
      />
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0d12]">
      <TISidebar />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <div className="p-6 lg:p-8">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route index element={<TIDashboard />} />
                <Route path="clientes" element={<TIClientes />} />
                <Route path="webhooks" element={<TIWebhooks />} />
                <Route path="dispositivos" element={<TIDispositivos />} />
                <Route path="senha" element={<TISenha />} />
                <Route path="configuracoes" element={<TIConfiguracoes />} />
                <Route path="logs" element={<TILogs />} />
                <Route path="manutencao" element={<TIManutencao />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TI;
