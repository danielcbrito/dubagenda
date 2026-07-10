import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getVerifiedAuthUser } from "@/utils/authSession";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse hash params (Supabase sends tokens in hash for implicit flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        const hashError = hashParams.get("error");

        if (hashError) {
          console.error("Auth callback error:", hashError, hashParams.get("error_description"));
          setError(true);
          setTimeout(() => navigate("/auth"), 1500);
          return;
        }

        // CASE 1: Email confirmation / password recovery (tokens in hash with type)
        if (type && accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("Session error:", sessionError);
            setError(true);
            setTimeout(() => navigate("/auth"), 1500);
            return;
          }

          localStorage.removeItem("pendingVerificationEmail");

          if (type === "recovery") {
            navigate("/resetar-senha", { replace: true });
            return;
          }

          // For signup/email_change confirmation, show success then route intelligently
          toast.success("E-mail confirmado com sucesso!");
        }

        // CASE 2: OAuth return (Google/Apple) or session already established
        // Supabase PKCE flow sets session automatically via ?code= before we get here

        // Unified: get current session and route intelligently
        const user = await getVerifiedAuthUser();

        if (!user) {
          navigate("/auth", { replace: true });
          return;
        }

        // Check user roles — block admins from client app
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (roles?.some(r => r.role === "admin")) {
          await supabase.auth.signOut();
          toast.error("Este aplicativo é exclusivo para clientes.");
          navigate("/auth", { replace: true });
          return;
        }

        // Check profile completeness
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, telefone, barbearia_preferida_id")
          .eq("id", user.id)
          .maybeSingle();

        const semPerfil = !profile?.nome || !profile?.telefone;
        if (semPerfil) {
          navigate("/completar-perfil", { replace: true });
          return;
        }

        const semBarbearia = !profile?.barbearia_preferida_id;
        if (semBarbearia) {
          navigate("/escolher-barbearia", { replace: true });
          return;
        }

        navigate("/cliente", { replace: true });
      } catch (err) {
        console.error("Callback processing error:", err);
        navigate("/auth", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background gap-4">
      {error ? (
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      ) : (
        <>
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Processando...</p>
        </>
      )}
    </div>
  );
};

export default AuthCallback;
