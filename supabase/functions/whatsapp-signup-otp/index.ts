import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

/** Normaliza para dígitos e garante prefixo 55 (BR). */
function normalizePhone(raw: string): string {
  let c = String(raw || "").replace(/\D/g, "");
  if (!c) return "";
  if (!c.startsWith("55")) c = "55" + c;
  return c;
}

function formatWa(phone: string) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function genToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, ...data } = await req.json();

    // ─────────── SEND: gera código e dispara webhook WhatsApp ───────────
    if (action === "send") {
      const phone = normalizePhone(data.phone || "");
      if (!phone || phone.length < 12 || phone.length > 13) {
        return json({ success: false, error: "Número de WhatsApp inválido" }, 400);
      }

      // Cooldown de 60s
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
          return json({
            success: false,
            error: `Aguarde ${Math.ceil(60 - diff)}s para reenviar.`,
            cooldown_remaining: Math.ceil(60 - diff),
          }, 429);
        }
      }

      // Invalida códigos anteriores
      await supabase
        .from("whatsapp_signup_otp")
        .update({ expires_at: new Date().toISOString() })
        .eq("phone", phone)
        .is("verified_at", null);

      const code = genCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: insErr } = await supabase
        .from("whatsapp_signup_otp")
        .insert({ phone, code, expires_at: expiresAt });

      if (insErr) {
        console.error("[whatsapp-signup-otp] insert error", insErr);
        return json({ success: false, error: "Erro ao gerar código" }, 500);
      }

      // Webhook (mesma config do fluxo pós-cadastro)
      const { data: cfg } = await supabase
        .from("webhook_config")
        .select("whatsapp_webhook_url, whatsapp_ativo, webhook_url, ativo")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const url = cfg?.whatsapp_webhook_url || cfg?.webhook_url;
      const ativo = cfg?.whatsapp_webhook_url ? cfg?.whatsapp_ativo : cfg?.ativo;

      if (url && ativo) {
        const payload = {
          evento: "verificacao_cadastro",
          cliente_nome: "Cliente",
          telefone: formatWa(phone),
          codigo: code,
          mensagem: `Ola! Seu codigo de verificacao DUB e ${code}. Expira em 5 minutos. Nao compartilhe.`,
          timestamp: new Date().toISOString(),
        };
        EdgeRuntime.waitUntil((async () => {
          try {
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          } catch (e) {
            console.warn("[whatsapp-signup-otp] webhook err", e);
          }
        })());
      } else {
        console.warn("[whatsapp-signup-otp] webhook not configured");
      }

      return json({ success: true, message: "Código enviado para o WhatsApp" });
    }

    // ─────────── VERIFY: valida código e retorna token ───────────
    if (action === "verify") {
      const phone = normalizePhone(data.phone || "");
      const code = String(data.code || "").trim();
      if (!phone || !/^\d{6}$/.test(code)) {
        return json({ success: false, error: "Dados inválidos" }, 400);
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

      if (!row) {
        return json({ success: false, error: "Código expirado. Solicite um novo." }, 400);
      }

      const attempts = (row.attempts || 0) + 1;
      await supabase.from("whatsapp_signup_otp").update({ attempts }).eq("id", row.id);

      if (row.code !== code) {
        if (attempts >= 5) {
          await supabase
            .from("whatsapp_signup_otp")
            .update({ expires_at: new Date().toISOString() })
            .eq("id", row.id);
          return json({ success: false, error: "Muitas tentativas. Solicite um novo código." }, 400);
        }
        return json({ success: false, error: `Código incorreto. Restam ${5 - attempts} tentativa(s).` }, 400);
      }

      const token = genToken();
      await supabase
        .from("whatsapp_signup_otp")
        .update({ verified_at: new Date().toISOString(), verification_token: token })
        .eq("id", row.id);

      return json({ success: true, phone, verification_token: token });
    }

    // ─────────── CONSUME: chamado após signUp para marcar profile ───────────
    // Body: { user_id, phone, verification_token }
    if (action === "consume") {
      const phone = normalizePhone(data.phone || "");
      const token = String(data.verification_token || "");
      const userId = String(data.user_id || "");
      if (!phone || !token || !userId) {
        return json({ success: false, error: "Dados incompletos" }, 400);
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

      if (!row) return json({ success: false, error: "Verificação não encontrada" }, 400);

      // Verificação deve ter sido concluída nos últimos 30 min
      const ageMin = (Date.now() - new Date(row.verified_at as string).getTime()) / 60000;
      if (ageMin > 30) return json({ success: false, error: "Verificação expirada" }, 400);

      // Marca telefone do perfil (verificado por OTP)
      await supabase
        .from("profiles")
        .update({ telefone: phone })
        .eq("id", userId);

      // Invalida o token (não pode ser reutilizado)
      await supabase
        .from("whatsapp_signup_otp")
        .update({ verification_token: null })
        .eq("id", row.id);

      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("[whatsapp-signup-otp] fatal", err);
    return json({ success: false, error: (err as Error).message || "Erro interno" }, 500);
  }
});
