import { useEffect } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
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
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="agenda" element={<AdminAgenda />} />
            <Route path="confirmacoes-pendentes" element={<AdminConfirmacoesPendentes />} />
            <Route path="clientes" element={<AdminClientes />} />
            <Route path="financeiro" element={<AdminFinanceiro />} />
            <Route path="relatorios" element={<AdminRelatorios />} />
            <Route path="servicos/*" element={<AdminServicos />} />
            <Route path="promocoes" element={<AdminPromocoes />} />
            <Route path="configuracoes" element={<AdminConfiguracoes />} />
            <Route path="apis" element={<AdminAPIs />} />
            <Route path="seguranca" element={<AdminSeguranca />} />
            <Route path="dev" element={<AdminDev />} />
          </Routes>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Admin;
