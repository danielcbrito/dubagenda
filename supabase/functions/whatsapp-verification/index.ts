import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Declaração para evitar erro de tipos; disponível em runtime no ambiente Edge
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Formata o número de telefone no padrão WhatsApp: NUMERO@s.whatsapp.net
 */
function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return `${cleaned}@s.whatsapp.net`;
}

/** Normaliza telefone BR para dígitos com DDI 55. */
function normalizePhone(phone: string): string {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return '';
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function generateVerificationToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Gera um código numérico de 6 dígitos
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...data } = await req.json();
    console.log(`[whatsapp-verification] Action: ${action}`);

    // =============================================
    // PRE-SIGNUP OTP: telefone -> código -> token
    // Usa a função existente para evitar limite de Edge Functions do projeto.
    // =============================================
    if (action === "signup_send") {
      const phone = normalizePhone(data.phone || "");
      if (!phone || phone.length < 12 || phone.length > 13) {
        return jsonResponse({ success: false, error: "Número de WhatsApp inválido" }, 400);
      }

      const { data: last } = await supabase
        .from("whatsapp_signup_otp")
        .select("created_at")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (last?.created_at) {
        const diff = (Date.now() - new Date(last.created_at).getTime()) / 1000;
        if (diff < 60) {
          return jsonResponse({
            success: false,
            error: `Aguarde ${Math.ceil(60 - diff)}s para reenviar.`,
            cooldown_remaining: Math.ceil(60 - diff),
          }, 429);
        }
      }

      await supabase
        .from("whatsapp_signup_otp")
        .update({ expires_at: new Date().toISOString() })
        .eq("phone", phone)
        .is("verified_at", null);

      const code = generateCode();
      const { error: insertError } = await supabase
        .from("whatsapp_signup_otp")
        .insert({
          phone,
          code,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });

      if (insertError) {
        console.error("[whatsapp-verification] signup_send insert error:", insertError);
        return jsonResponse({ success: false, error: "Erro ao gerar código" }, 500);
      }

      // Webhook fixo dedicado ao OTP de cadastro (n8n)
      const webhookUrl = "https://n8n-n8n.xcyr4f.easypanel.host/webhook/1b63ce24-4d00-4b74-9eac-104fdd812e01";

      const mensagem = code;
      const webhookPayload = {
        evento: "verificacao_cadastro",
        descricao: "Codigo OTP de verificacao para cadastro de cliente",
        timestamp: new Date().toISOString(),
        cliente_nome: "Cliente",
        cliente_telefone: phone,
        cliente_telefone_whatsapp: formatPhoneForWhatsApp(phone),
        telefone: formatPhoneForWhatsApp(phone),
        codigo: code,
        expira_em_minutos: 5,
        mensagem,
      };

      EdgeRuntime.waitUntil((async () => {
        try {
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
          });
          if (!response.ok) {
            console.warn("[whatsapp-verification] signup_send webhook failed:", response.status, await response.text());
          }
        } catch (err) {
          console.warn("[whatsapp-verification] signup_send webhook error:", err);
        }
      })());

      return jsonResponse({ success: true, message: "Código enviado para seu WhatsApp" });
    }

    if (action === "signup_verify") {
      const phone = normalizePhone(data.phone || "");
      const code = String(data.code || "").trim();
      if (!phone || !/^\d{6}$/.test(code)) {
        return jsonResponse({ success: false, error: "Dados inválidos" }, 400);
      }

      const { data: row } = await supabase
        .from("whatsapp_signup_otp")
        .select("*")
        .eq("phone", phone)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return jsonResponse({ success: false, error: "Código expirado. Solicite um novo." }, 400);

      const attempts = (row.attempts || 0) + 1;
      await supabase.from("whatsapp_signup_otp").update({ attempts }).eq("id", row.id);

      if (row.code !== code) {
        if (attempts >= 5) {
          await supabase.from("whatsapp_signup_otp").update({ expires_at: new Date().toISOString() }).eq("id", row.id);
          return jsonResponse({ success: false, error: "Muitas tentativas. Solicite um novo código." }, 400);
        }
        return jsonResponse({ success: false, error: `Código incorreto. Restam ${5 - attempts} tentativa(s).` }, 400);
      }

      const token = generateVerificationToken();
      await supabase
        .from("whatsapp_signup_otp")
        .update({ verified_at: new Date().toISOString(), verification_token: token })
        .eq("id", row.id);

      return jsonResponse({ success: true, phone, verification_token: token });
    }

    if (action === "signup_consume") {
      const phone = normalizePhone(data.phone || "");
      const token = String(data.verification_token || "");
      const userId = String(data.user_id || "");
      if (!phone || !token || !userId) {
        return jsonResponse({ success: false, error: "Dados incompletos" }, 400);
      }

      const { data: row } = await supabase
        .from("whatsapp_signup_otp")
        .select("id, verified_at, verification_token")
        .eq("phone", phone)
        .eq("verification_token", token)
        .not("verified_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return jsonResponse({ success: false, error: "Verificação não encontrada" }, 400);

      const ageMin = (Date.now() - new Date(row.verified_at as string).getTime()) / 60000;
      if (ageMin > 30) return jsonResponse({ success: false, error: "Verificação expirada" }, 400);

      await supabase.from("profiles").update({ telefone: phone }).eq("id", userId);
      await supabase.from("whatsapp_signup_otp").update({ verification_token: null }).eq("id", row.id);

      try {
        await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
      } catch (e) {
        console.warn("[whatsapp-verification] auto email_confirm falhou:", e);
      }

      return jsonResponse({ success: true });
    }

    // =============================================
    // ACTION: signup_create_account
    // Cria a conta 100% via admin API — sem envio de email de confirmação.
    // Requer OTP de WhatsApp já validado (verification_token).
    // =============================================
    if (action === "signup_create_account") {
      const phone = normalizePhone(data.phone || "");
      const token = String(data.verification_token || "");
      const email = String(data.email || "").trim().toLowerCase();
      const password = String(data.password || "");
      const signupOrigin = String(data.signup_origin || "cliente");
      const nome = String(data.nome || email.split("@")[0] || "Cliente");

      if (!phone || !token || !email || !password) {
        return jsonResponse({ success: false, error: "Dados incompletos" }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ success: false, error: "Senha muito curta" }, 400);
      }

      const { data: row } = await supabase
        .from("whatsapp_signup_otp")
        .select("id, verified_at, verification_token")
        .eq("phone", phone)
        .eq("verification_token", token)
        .not("verified_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return jsonResponse({ success: false, error: "Verificação de WhatsApp não encontrada" }, 400);
      const ageMin = (Date.now() - new Date(row.verified_at as string).getTime()) / 60000;
      if (ageMin > 30) return jsonResponse({ success: false, error: "Verificação expirada. Refaça o OTP." }, 400);

      // Cria usuário JÁ com email confirmado — impede envio de email pelo GoTrue.
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          signup_origin: signupOrigin,
          telefone: phone,
          phone_verified_via_whatsapp: true,
          nome,
        },
      });

      if (createErr || !created?.user) {
        const msg = (createErr?.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          return jsonResponse({ success: false, error: "Este email já possui uma conta", code: "email_exists" }, 409);
        }
        console.error("[signup_create_account] createUser failed", createErr);
        return jsonResponse({ success: false, error: "Erro ao criar conta" }, 500);
      }

      const userId = created.user.id;

      // Garante telefone e consome token
      await supabase.from("profiles").update({ telefone: phone }).eq("id", userId);
      await supabase.from("whatsapp_signup_otp").update({ verification_token: null }).eq("id", row.id);

      return jsonResponse({ success: true, user_id: userId });
    }

    // =============================================
    // ACTION: generate - Gerar e enviar código
    // =============================================
    if (action === "generate") {
      const { user_id, phone, user_name, user_email, user_cpf } = data;

      if (!user_id || !phone) {
        return new Response(
          JSON.stringify({ success: false, error: "user_id e phone são obrigatórios" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Invalidar códigos anteriores do usuário
      await supabase
        .from('whatsapp_verification_codes')
        .update({ expires_at: new Date().toISOString() })
        .eq('user_id', user_id)
        .is('verified_at', null);

      // Gerar novo código
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

      // Salvar código no banco
      const { error: insertError } = await supabase
        .from('whatsapp_verification_codes')
        .insert({
          user_id,
          phone,
          code,
          expires_at: expiresAt.toISOString(),
          user_name,
          user_email,
          user_cpf,
        });

      if (insertError) {
        console.error('[whatsapp-verification] Erro ao salvar código:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao gerar código" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      // Buscar configuração do webhook DEDICADO para WhatsApp (sempre a mais recente)
      const { data: webhookConfig } = await supabase
        .from('webhook_config')
        .select('whatsapp_webhook_url, whatsapp_ativo, webhook_url, ativo')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Priorizar webhook dedicado para WhatsApp, senão usar o padrão
      const webhookUrl = webhookConfig?.whatsapp_webhook_url || webhookConfig?.webhook_url;
      const webhookAtivo = webhookConfig?.whatsapp_webhook_url 
        ? webhookConfig?.whatsapp_ativo 
        : webhookConfig?.ativo;

      // Preparar mensagem pronta para WhatsApp (limpa, sem emojis, sem acentos)
      const mensagemWhatsApp = `Ola ${user_name || "Cliente"}, seu codigo de verificacao e ${code}. Expira em 5 minutos. Nao compartilhe.`;

      if (webhookUrl && webhookAtivo) {
        const webhookPayload = {
          evento: "verificacao_cadastro",
          cliente_nome: user_name || "Cliente",
          telefone: formatPhoneForWhatsApp(phone),
          codigo: code,
          mensagem: mensagemWhatsApp,
          timestamp: new Date().toISOString(),
        };

        console.log('[whatsapp-verification] Enfileirando envio para webhook:', webhookUrl);

        // Enviar para webhook em background para não travar o usuário
        EdgeRuntime.waitUntil((async () => {
          let webhookSuccess = false;
          let lastError: string | null = null;

          try {
            const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload),
            });

            if (response.ok) {
              webhookSuccess = true;
              console.log('[whatsapp-verification] Webhook enviado com sucesso');
            } else {
              lastError = `HTTP ${response.status}: ${await response.text()}`;
              console.warn('[whatsapp-verification] Falha ao enviar webhook:', lastError);
            }
          } catch (err: unknown) {
            lastError = err instanceof Error ? err.message : String(err);
            console.warn('[whatsapp-verification] Erro ao enviar webhook:', lastError);
          }

          // Log do resultado
          try {
            await supabase.from('system_logs').insert({
              level: webhookSuccess ? 'info' : 'warn',
              category: 'whatsapp_verification',
              message: webhookSuccess 
                ? 'Código de verificação enviado via webhook' 
                : 'Falha ao enviar código via webhook',
              details: { user_id, phone, webhook_success: webhookSuccess, error: lastError },
              user_id,
            });
          } catch (logErr) {
            console.error('[whatsapp-verification] Erro ao registrar log:', logErr);
          }
        })());
      } else {
        console.warn('[whatsapp-verification] Webhook não configurado ou inativo');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Código enviado para seu WhatsApp" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // ACTION: verify - Verificar código
    // =============================================
    if (action === "verify") {
      const { user_id, code } = data;

      if (!user_id || !code) {
        return new Response(
          JSON.stringify({ success: false, error: "user_id e code são obrigatórios" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Buscar código válido
      const { data: verification, error: fetchError } = await supabase
        .from('whatsapp_verification_codes')
        .select('*')
        .eq('user_id', user_id)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !verification) {
        console.log('[whatsapp-verification] Código não encontrado ou expirado');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Código expirado ou inválido. Solicite um novo código." 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Incrementar tentativas
      await supabase
        .from('whatsapp_verification_codes')
        .update({ attempts: (verification.attempts || 0) + 1 })
        .eq('id', verification.id);

      // Verificar se código está correto
      if (verification.code !== code) {
        const attempts = (verification.attempts || 0) + 1;
        if (attempts >= 5) {
          // Invalidar código após 5 tentativas
          await supabase
            .from('whatsapp_verification_codes')
            .update({ expires_at: new Date().toISOString() })
            .eq('id', verification.id);

          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Muitas tentativas incorretas. Solicite um novo código." 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Código incorreto. Você tem mais ${5 - attempts} tentativa(s).` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Código correto - marcar como verificado
      await supabase
        .from('whatsapp_verification_codes')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', verification.id);

      // Confirmar email do usuário no Supabase Auth
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(user_id, {
        email_confirm: true,
      });

      if (updateAuthError) {
        console.error('[whatsapp-verification] Erro ao confirmar email:', updateAuthError);
      }

      console.log('[whatsapp-verification] Verificação concluída com sucesso para:', user_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Código verificado com sucesso! Seu cadastro está confirmado." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // ACTION: reset_password_send - Enviar código de recuperação
    // =============================================
    if (action === "reset_password_send") {
      const phone = normalizePhone(data.phone || "");
      if (!phone || phone.length < 12) {
        return jsonResponse({ success: false, error: "Número de WhatsApp inválido" }, 400);
      }

      // Verificar se existe um perfil vinculado a este número
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("telefone", phone)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ success: false, error: "Nenhuma conta vinculada a este número de WhatsApp." }, 200);
      }

      // Invalidar códigos de recuperação anteriores para este telefone
      await supabase
        .from("whatsapp_verification_codes")
        .update({ expires_at: new Date().toISOString() })
        .eq("phone", phone)
        .is("verified_at", null);

      const code = generateCode();
      const { error: insertError } = await supabase
        .from("whatsapp_verification_codes")
        .insert({
          user_id: profile.id,
          phone,
          code,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          user_name: profile.nome
        });

      if (insertError) {
        return jsonResponse({ success: false, error: "Erro ao gerar código de recuperação" }, 500);
      }

      // Webhook para envio de WhatsApp (usar webhook_config ou o fallback)
      const { data: webhookConfig } = await supabase
        .from('webhook_config')
        .select('whatsapp_webhook_url, whatsapp_ativo, webhook_url, ativo')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const webhookUrl = webhookConfig?.whatsapp_webhook_url || webhookConfig?.webhook_url || "https://n8n-n8n.xcyr4f.easypanel.host/webhook/1b63ce24-4d00-4b74-9eac-104fdd812e01";
      
      const webhookPayload = {
        evento: "recuperacao_senha",
        cliente_nome: profile.nome || "Cliente",
        telefone: formatPhoneForWhatsApp(phone),
        codigo: code,
        mensagem: `Ola ${profile.nome || "Cliente"}, seu codigo de recuperacao de senha e: ${code}. Nao compartilhe.`,
        timestamp: new Date().toISOString(),
      };

      EdgeRuntime.waitUntil((async () => {
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
          });
        } catch (err) {
          console.warn("[whatsapp-verification] reset_password_send webhook error:", err);
        }
      })());

      return jsonResponse({ success: true, message: "Código enviado para seu WhatsApp" });
    }

    // =============================================
    // ACTION: reset_password_verify - Verificar código de recuperação
    // =============================================
    if (action === "reset_password_verify") {
      const phone = normalizePhone(data.phone || "");
      const code = String(data.code || "").trim();
      if (!phone || !/^\d{6}$/.test(code)) {
        return jsonResponse({ success: false, error: "Dados inválidos" }, 400);
      }

      const { data: row } = await supabase
        .from("whatsapp_verification_codes")
        .select("*")
        .eq("phone", phone)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return jsonResponse({ success: false, error: "Código expirado ou inválido. Solicite um novo." }, 400);

      const attempts = (row.attempts || 0) + 1;
      await supabase.from("whatsapp_verification_codes").update({ attempts }).eq("id", row.id);

      if (row.code !== code) {
        if (attempts >= 5) {
          await supabase.from("whatsapp_verification_codes").update({ expires_at: new Date().toISOString() }).eq("id", row.id);
          return jsonResponse({ success: false, error: "Muitas tentativas. Solicite um novo código." }, 400);
        }
        return jsonResponse({ success: false, error: `Código incorreto. Restam ${5 - attempts} tentativa(s).` }, 400);
      }

      const token = generateVerificationToken();
      await supabase
        .from("whatsapp_verification_codes")
        .update({ verified_at: new Date().toISOString(), verification_token: token })
        .eq("id", row.id);

      return jsonResponse({ success: true, verification_token: token });
    }

    // =============================================
    // ACTION: reset_password_execute - Alterar senha via Admin API
    // =============================================
    if (action === "reset_password_execute") {
      const phone = normalizePhone(data.phone || "");
      const token = String(data.verification_token || "");
      const newPassword = String(data.new_password || "");

      if (!phone || !token || !newPassword || newPassword.length < 6) {
        return jsonResponse({ success: false, error: "Dados inválidos para redefinição" }, 400);
      }

      const { data: row } = await supabase
        .from("whatsapp_verification_codes")
        .select("id, user_id, verified_at, verification_token")
        .eq("phone", phone)
        .eq("verification_token", token)
        .not("verified_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return jsonResponse({ success: false, error: "Verificação de segurança não encontrada ou expirada" }, 400);

      // Executar a mudança de senha via Admin API
      const { error: updateErr } = await supabase.auth.admin.updateUserById(row.user_id, {
        password: newPassword,
        email_confirm: true
      });

      if (updateErr) {
        console.error("[reset_password_execute] auth update error:", updateErr);
        return jsonResponse({ success: false, error: "Erro ao atualizar senha no sistema" }, 500);
      }

      // Consumir token
      await supabase.from("whatsapp_verification_codes").update({ verification_token: null }).eq("id", row.id);

      return jsonResponse({ success: true, message: "Senha alterada com sucesso!" });
    }

    // =============================================
    // ACTION: resend - Reenviar código
    // =============================================
    if (action === "resend") {
      const { user_id } = data;

      if (!user_id) {
        return new Response(
          JSON.stringify({ success: false, error: "user_id é obrigatório" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Buscar último código para obter dados do usuário
      const { data: lastCode } = await supabase
        .from('whatsapp_verification_codes')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!lastCode) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhum cadastro encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Verificar cooldown (60 segundos)
      const lastCreated = new Date(lastCode.created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - lastCreated.getTime()) / 1000;

      if (diffSeconds < 60) {
        const remaining = Math.ceil(60 - diffSeconds);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Aguarde ${remaining} segundos para reenviar o código.`,
            cooldown_remaining: remaining
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }

      // Invalidar códigos anteriores do usuário
      await supabase
        .from('whatsapp_verification_codes')
        .update({ expires_at: new Date().toISOString() })
        .eq('user_id', user_id)
        .is('verified_at', null);

      // Gerar novo código
      const newCode = generateCode();
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Salvar novo código
      const { error: insertError } = await supabase
        .from('whatsapp_verification_codes')
        .insert({
          user_id,
          phone: lastCode.phone,
          code: newCode,
          expires_at: newExpiresAt.toISOString(),
          user_name: lastCode.user_name,
          user_email: lastCode.user_email,
          user_cpf: lastCode.user_cpf,
        });

      if (insertError) {
        console.error('[whatsapp-verification] Erro ao salvar novo código:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao gerar novo código" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      // Buscar configuração do webhook DEDICADO para WhatsApp (sempre a mais recente)
      const { data: webhookConfigResend } = await supabase
        .from('webhook_config')
        .select('whatsapp_webhook_url, whatsapp_ativo, webhook_url, ativo')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Priorizar webhook dedicado para WhatsApp
      const resendWebhookUrl = webhookConfigResend?.whatsapp_webhook_url || webhookConfigResend?.webhook_url;
      const resendWebhookAtivo = webhookConfigResend?.whatsapp_webhook_url 
        ? webhookConfigResend?.whatsapp_ativo 
        : webhookConfigResend?.ativo;

      if (!resendWebhookUrl || !resendWebhookAtivo) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Código gerado (webhook não configurado)" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Preparar mensagem pronta para WhatsApp (limpa, sem emojis, sem acentos)
      const resendMensagemWhatsApp = `Ola ${lastCode.user_name || "Cliente"}, seu codigo de verificacao e ${newCode}. Expira em 5 minutos. Nao compartilhe.`;

      // Enviar para webhook
      const webhookPayload = {
        evento: "verificacao_cadastro",
        cliente_nome: lastCode.user_name || "Cliente",
        telefone: formatPhoneForWhatsApp(lastCode.phone),
        codigo: newCode,
        mensagem: resendMensagemWhatsApp,
        timestamp: new Date().toISOString(),
      };

      try {
        await fetch(resendWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });
      } catch (webhookErr) {
        console.warn('[whatsapp-verification] Erro no webhook:', webhookErr);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Novo código enviado para seu WhatsApp" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error: any) {
    console.error("[whatsapp-verification] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
