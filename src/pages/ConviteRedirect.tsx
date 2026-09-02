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
  const { code, slug } = useParams<{ code: string; slug?: string }>();
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
        if (slug) sessionStorage.setItem("pending_referral_slug", slug);
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

      // Resolve slug → tenant id para pré-selecionar a barbearia do indicador
      let tenantId = "";
      if (slug) {
        try {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (tenant?.id) tenantId = tenant.id;
        } catch {
          /* silent */
        }
      }

      // Se resolvemos o tenant pelo slug, pula a tela de escolher barbearia
      // e vai direto pro cadastro já vinculado à barbearia do indicador.
      if (tenantId) {
        try {
          localStorage.setItem("dub_has_barbershop", "true");
        } catch { /* ignore */ }
        const params = new URLSearchParams({
          mode: "signup",
          tenant: tenantId,
          origin: "invite",
          ref: codeUp,
        });
        navigate(`/auth?${params.toString()}`, { replace: true });
        return;
      }

      // Fallback: sem slug válido, mostra o seletor
      navigate(
        `/escolher-barbearia?mode=invite&ref=${encodeURIComponent(codeUp)}`,
        { replace: true }
      );
    };
    run();
  }, [code, slug, navigate]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}
