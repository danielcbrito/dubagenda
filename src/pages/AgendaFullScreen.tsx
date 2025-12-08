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
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Premium Background Light Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main red light orbs */}
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-primary/6 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/4 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Smaller scattered red dots */}
        <div className="absolute top-[25%] right-[25%] w-3 h-3 rounded-full bg-primary/40 blur-[2px] animate-pulse" />
        <div className="absolute top-[60%] left-[20%] w-2 h-2 rounded-full bg-primary/30 blur-[1px] animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-[35%] right-[35%] w-4 h-4 rounded-full bg-primary/35 blur-[3px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[15%] right-[45%] w-2 h-2 rounded-full bg-primary/25 blur-[1px] animate-pulse" style={{ animationDelay: '0.8s' }} />
        <div className="absolute bottom-[15%] left-[40%] w-3 h-3 rounded-full bg-primary/30 blur-[2px] animate-pulse" style={{ animationDelay: '1.2s' }} />
        
        {/* Subtle depth gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 p-8">
        <AdminAgenda />
      </div>
    </div>
  );
};

export default AgendaFullScreen;
