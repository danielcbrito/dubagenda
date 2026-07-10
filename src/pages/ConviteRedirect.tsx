import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * /i/:code — Landing público de convite.
 * Registra o clique (status="link_clicked") em tempo real
 * e redireciona para /auth?ref=CODE.
 */
export default function ConviteRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const codeUp = (code || "").trim().toUpperCase();
      if (!codeUp) {
        navigate("/auth", { replace: true });
        return;
      }

      // Session id persistente por navegador (usado pra promover o clique em conta)
      let sessionId = "";
      try {
        sessionId = localStorage.getItem("dub_ref_session_id") || "";
        if (!sessionId) {
          sessionId =
            (crypto as any)?.randomUUID?.() ||
            `sid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          localStorage.setItem("dub_ref_session_id", sessionId);
        }
        sessionStorage.setItem("pending_referral_code", codeUp);
        sessionStorage.setItem("pending_referral_session_id", sessionId);
      } catch {
        /* ignore */
      }

      try {
        await supabase.rpc("registrar_click_indicacao", {
          p_codigo: codeUp,
          p_session_id: sessionId,
        });
      } catch {
        /* silent */
      }

      // Fluxo do convite: primeiro escolhe barbearia, depois segue o cadastro
      // padrão (WhatsApp OTP → email/senha). O tenant escolhido é passado
      // adiante via ?tenant= para vincular à conta na criação.
      navigate(`/escolher-barbearia?mode=invite&ref=${encodeURIComponent(codeUp)}`, { replace: true });
    };
    run();
  }, [code, navigate]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}
