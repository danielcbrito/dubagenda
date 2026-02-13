import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    // Gera link de recuperação via Admin API (sem rate limit de email)
    // e retorna o link para o frontend redirecionar o usuário
    // ──────────────────────────────────────────────
    if (action === "send_recovery") {
      if (!user_email) {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[send_recovery] Gerando link para: ${user_email}`);

      const finalRedirect = redirect_to || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/resetar-senha`;

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: user_email,
        options: {
          redirectTo: finalRedirect,
        },
      });

      if (error) {
        console.error("[send_recovery] Erro ao gerar link:", error);
        // Se o email não existe, retornar sucesso mesmo assim (prevenir enumeração)
        if (error.message?.includes("User not found") || error.message?.includes("not found")) {
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Se o email existir, o link foi gerado." 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const actionLink = data?.properties?.action_link;
      console.log("[send_recovery] Link gerado com sucesso");

      return new Response(JSON.stringify({ 
        success: true, 
        action_link: actionLink,
        message: "Link de recuperação gerado com sucesso" 
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
        console.error("Erro ao gerar link:", error);
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
        console.error("Erro ao redefinir senha:", error);
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
