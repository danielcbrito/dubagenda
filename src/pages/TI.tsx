import { useEffect, useState, Suspense } from "react";
import { useNavigate, Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TISidebar } from "@/components/ti/TISidebar";
import { TIDashboard } from "@/components/ti/TIDashboard";
import { TIDatabase } from "@/components/ti/TIDatabase";
import { TIConfiguracoes } from "@/components/ti/TIConfiguracoes";
import { TIAPIs } from "@/components/ti/TIAPIs";
import { TISeguranca } from "@/components/ti/TISeguranca";
import { TILogs } from "@/components/ti/TILogs";
import { TIManutencao } from "@/components/ti/TIManutencao";

const TI = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    // Verificar se é admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      toast.error("Acesso não autorizado - Apenas administradores");
      navigate("/cliente");
      return;
    }
  };

  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Carregando módulo...</p>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#0A0A0F]">
      {/* Background effects - Tech style */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
        
        {/* Glow effects */}
        <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-32 -right-32 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>
      
      {/* Sidebar TI */}
      <TISidebar />
      
      {/* Conteúdo principal */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
          <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route index element={<TIDashboard />} />
                <Route path="database" element={<TIDatabase />} />
                <Route path="configuracoes" element={<TIConfiguracoes />} />
                <Route path="apis" element={<TIAPIs />} />
                <Route path="seguranca" element={<TISeguranca />} />
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
