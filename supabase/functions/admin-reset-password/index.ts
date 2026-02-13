import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Envia email de recuperação de senha via Resend (bypassa rate limit do Supabase)
 */
async function sendRecoveryViaResend(
  email: string,
  recoveryLink: string,
  resendApiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#1a1a1a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="width:56px;height:56px;margin:0 auto 16px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:24px;font-weight:700;color:#fff;">D</span>
              </div>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#ffffff;">
                Recuperação de Senha
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.5;">
                Você solicitou a redefinição da sua senha na <strong style="color:rgba(255,255,255,0.7);">Barbearia DUB</strong>
              </p>
            </td>
          </tr>
          <!-- Button -->
          <tr>
            <td style="padding:32px;">
              <a href="${recoveryLink}" 
                 style="display:block;width:100%;padding:14px 24px;background-color:#ef4444;color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:600;border-radius:12px;box-sizing:border-box;">
                Redefinir minha senha
              </a>
              <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.35);text-align:center;line-height:1.5;">
                Este link expira em 1 hora.<br>
                Se você não solicitou isso, ignore este email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 24px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.25);text-align:center;">
                Barbearia DUB &mdash; Cuidando do seu estilo
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Barbearia DUB <onboarding@resend.dev>",
        to: [email],
        subject: "Redefinir sua senha — Barbearia DUB",
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Resend] Erro ${response.status}:`, errorBody);
      return { success: false, error: `Falha ao enviar email: ${response.status}` };
    }

    const data = await response.json();
    console.log("[Resend] Email enviado com sucesso:", data.id);
    return { success: true };
  } catch (err) {
    console.error("[Resend] Exceção:", err);
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, user_email, user_id, new_password, redirect_to } = body;

    // ──────────────────────────────────────────────
    // ACTION: send_recovery (público — não requer auth)
    // Gera link via Admin API + envia email via Resend
    // ──────────────────────────────────────────────
    if (action === "send_recovery") {
      if (!user_email || typeof user_email !== "string") {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!resendApiKey) {
        console.error("[send_recovery] RESEND_API_KEY não configurada");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Se o email estiver cadastrado, um link de recuperação foi enviado." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailTrimmed = user_email.trim().toLowerCase();
      console.log(`[send_recovery] Processando recuperação para: ${emailTrimmed}`);

      const finalRedirect = redirect_to || "https://dubagenda.lovable.app/resetar-senha";

      // Gerar link de recuperação via Admin API (não envia email, só gera o link)
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: emailTrimmed,
        options: {
          redirectTo: finalRedirect,
        },
      });

      if (linkError) {
        // Se o usuário não existe, não revelar isso
        console.error("[send_recovery] Erro ao gerar link:", linkError.message);
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Se o email estiver cadastrado, um link de recuperação foi enviado." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recoveryLink = linkData?.properties?.action_link;
      if (!recoveryLink) {
        console.error("[send_recovery] Link não gerado");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Se o email estiver cadastrado, um link de recuperação foi enviado." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[send_recovery] Link gerado, enviando via Resend...");

      // Enviar email via Resend
      const emailResult = await sendRecoveryViaResend(emailTrimmed, recoveryLink, resendApiKey);

      if (!emailResult.success) {
        console.error("[send_recovery] Falha no envio Resend:", emailResult.error);
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
