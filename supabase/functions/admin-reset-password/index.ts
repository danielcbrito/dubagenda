import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Envia email de recuperação usando a API REST do Supabase Auth
 * com a service_role key (bypassa rate limit por usuário)
 * O email é enviado pelo SMTP customizado configurado no Supabase
 */
async function sendRecoveryViaAuthAPI(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  redirectTo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        gotrue_meta_security: {},
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[sendRecovery] Erro ${response.status}:`, errorBody);
      return { success: false, error: `Erro ${response.status}: ${errorBody}` };
    }

    console.log("[sendRecovery] Email de recuperação enviado com sucesso via SMTP");
    return { success: true };
  } catch (err) {
    console.error("[sendRecovery] Exceção:", err);
    return { success: false, error: "Erro interno ao enviar email" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, user_email, user_id, new_password, redirect_to } = body;

    // ──────────────────────────────────────────────
    // ACTION: send_recovery (público — não requer auth)
    // Envia email via SMTP usando service_role (sem rate limit)
    // ──────────────────────────────────────────────
    if (action === "send_recovery") {
      if (!user_email || typeof user_email !== "string") {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailTrimmed = user_email.trim().toLowerCase();
      console.log(`[send_recovery] Enviando recuperação para: ${emailTrimmed}`);

      // Usar API REST /auth/v1/recover com service_role key
      // Isso usa o SMTP customizado configurado no Supabase e bypassa rate limit
      const result = await sendRecoveryViaAuthAPI(
        supabaseUrl,
        supabaseServiceKey,
        emailTrimmed,
        redirect_to || "https://dubagenda.lovable.app/resetar-senha"
      );

      if (!result.success) {
        console.error("[send_recovery] Falha:", result.error);
      } else {
        console.log("[send_recovery] Sucesso! Email deve chegar em breve.");
      }

      // Sempre retornar sucesso para não revelar se o email existe
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Se o email estiver cadastrado, um link de recuperação foi enviado." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────
    // ACTIONS protegidas (requerem admin autenticado)
    // ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se é admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: generate_link (admin)
    if (action === "generate_link") {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: user_email,
        options: {
          redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/resetar-senha`,
        },
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        link: data?.properties?.action_link,
        message: "Link de recuperação gerado com sucesso" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ACTION: reset_password (admin)
    } else if (action === "reset_password") {
      if (!user_id || !new_password) {
        return new Response(JSON.stringify({ error: "user_id e new_password são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new_password.length < 6) {
        return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Senha redefinida com sucesso" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
