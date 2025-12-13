import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

/**
 * Gera um código numérico de 6 dígitos
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
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

      // Buscar configuração do webhook
      const { data: webhookConfig } = await supabase
        .from('webhook_config')
        .select('webhook_url, ativo')
        .single();

      if (!webhookConfig?.webhook_url || !webhookConfig.ativo) {
        console.warn('[whatsapp-verification] Webhook não configurado ou inativo');
        // Retorna sucesso mesmo sem webhook (para testes)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Código gerado (webhook não configurado)",
            code_for_testing: code // REMOVER EM PRODUÇÃO
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Preparar payload para webhook
      const webhookPayload = {
        evento: "verificacao_cadastro",
        cliente_nome: user_name || "Cliente",
        telefone: formatPhoneForWhatsApp(phone),
        codigo: code,
        timestamp: new Date().toISOString(),
      };

      console.log('[whatsapp-verification] Enviando para webhook:', webhookConfig.webhook_url);

      // Enviar para webhook com retry
      let webhookSuccess = false;
      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(webhookConfig.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          });

          if (response.ok) {
            webhookSuccess = true;
            console.log('[whatsapp-verification] Webhook enviado com sucesso');
            break;
          } else {
            lastError = `HTTP ${response.status}: ${await response.text()}`;
            console.warn(`[whatsapp-verification] Tentativa ${attempt + 1} falhou:`, lastError);
          }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : String(err);
          console.warn(`[whatsapp-verification] Tentativa ${attempt + 1} erro:`, lastError);
        }

        // Aguardar antes de retry
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      // Log do resultado
      await supabase.from('system_logs').insert({
        level: webhookSuccess ? 'info' : 'warn',
        category: 'whatsapp_verification',
        message: webhookSuccess 
          ? 'Código de verificação enviado via webhook' 
          : 'Falha ao enviar código via webhook',
        details: { user_id, phone, webhook_success: webhookSuccess, error: lastError },
        user_id,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          webhook_sent: webhookSuccess,
          message: webhookSuccess 
            ? "Código enviado para seu WhatsApp" 
            : "Código gerado, mas houve problema ao enviar via WhatsApp"
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

      // Buscar configuração do webhook
      const { data: webhookConfig } = await supabase
        .from('webhook_config')
        .select('webhook_url, ativo')
        .single();

      if (!webhookConfig?.webhook_url || !webhookConfig.ativo) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Código gerado (webhook não configurado)" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Enviar para webhook
      const webhookPayload = {
        evento: "verificacao_cadastro",
        cliente_nome: lastCode.user_name || "Cliente",
        telefone: formatPhoneForWhatsApp(lastCode.phone),
        codigo: newCode,
        timestamp: new Date().toISOString(),
      };

      try {
        await fetch(webhookConfig.webhook_url, {
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
