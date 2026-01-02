import { useEffect, Suspense } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TISidebar } from "@/components/ti/TISidebar";
import { TIDashboard } from "@/components/ti/TIDashboard";
import { TIClientes } from "@/components/ti/TIClientes";
import { TIWebhooks } from "@/components/ti/TIWebhooks";
import { TIConfiguracoes } from "@/components/ti/TIConfiguracoes";
import { TILogs } from "@/components/ti/TILogs";
import { TIManutencao } from "@/components/ti/TIManutencao";

const TI = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
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
  };

  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

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
