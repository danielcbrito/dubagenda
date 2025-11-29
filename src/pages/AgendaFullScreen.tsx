import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminAgenda } from "@/components/admin/AdminAgenda";

/**
 * Página de agenda em tela cheia (sem sidebar, sem menu)
 * Usada quando o admin abre a agenda em nova aba
 */
const AgendaFullScreen = () => {
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
    <div className="min-h-screen w-full bg-background p-8">
      <AdminAgenda />
    </div>
  );
};

export default AgendaFullScreen;
