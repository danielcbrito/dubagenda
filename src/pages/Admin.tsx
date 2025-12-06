import { useEffect, Suspense } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Loader2 } from "lucide-react";
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
import AdminHorarios from "@/components/admin/AdminHorarios";

const Admin = () => {
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

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden">
          <div className="min-h-full">
          <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            </div>
          }>
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
              <Route path="configuracoes" element={<AdminConfiguracoes />} />
              <Route path="apis" element={<AdminAPIs />} />
              <Route path="seguranca" element={<AdminSeguranca />} />
              <Route path="horarios" element={<AdminHorarios />} />
              <Route path="dev" element={<AdminDev />} />
            </Routes>
          </Suspense>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Admin;
