// ai-security-monitor — Agente de IA que monitora o app procurando
// burlações, bugs e comportamento suspeito. Envia alertas via webhook
// (WhatsApp) para Daniel Brito.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Destinatário dos alertas (Daniel Brito - admin).
// Pode ser sobrescrito via secret ALERT_RECIPIENT_PHONE.
const ALERT_PHONE =
  Deno.env.get("ALERT_RECIPIENT_PHONE") || "11982573707";
const ALERT_NAME = "Daniel Brito";

interface Signal {
  categoria: string;
  severidade: "low" | "medium" | "high" | "critical";
  titulo: string;
  descricao: string;
  cliente_id?: string;
  cliente_nome?: string;
  evidencias: Record<string, unknown>;
}

async function collectSignals(
  supabase: ReturnType<typeof createClient>,
  sinceIso: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  // 1) Agendamentos múltiplos do mesmo cliente em pouco tempo (>=3 em 30min)
  const { data: agRecent } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, created_at, status, payment_method")
    .gte("created_at", sinceIso)
    .limit(1000);

  const byClient = new Map<string, any[]>();
  (agRecent || []).forEach((a: any) => {
    if (!a.cliente_id) return;
    const arr = byClient.get(a.cliente_id) || [];
    arr.push(a);
    byClient.set(a.cliente_id, arr);
  });

  for (const [cliente_id, arr] of byClient) {
    if (arr.length >= 3) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", cliente_id)
        .maybeSingle();
      signals.push({
        categoria: "booking_flood",
        severidade: arr.length >= 5 ? "high" : "medium",
        titulo: "Cliente criou muitos agendamentos seguidos",
        descricao: `${arr.length} agendamentos criados em 30 minutos.`,
        cliente_id,
        cliente_nome: (prof as any)?.nome,
        evidencias: { quantidade: arr.length, ids: arr.map((x) => x.id) },
      });
    }
  }

  // 2) Tentativas de resgate múltiplas (fidelidade)
  const { data: resAtivos } = await supabase
    .from("resgates")
    .select("id, user_id, status, appointment_id, created_at")
    .in("status", ["available", "used"])
    .gte("created_at", sinceIso)
    .limit(500);

  const resByUser = new Map<string, any[]>();
  (resAtivos || []).forEach((r: any) => {
    const arr = resByUser.get(r.user_id) || [];
    arr.push(r);
    resByUser.set(r.user_id, arr);
  });
  for (const [user_id, arr] of resByUser) {
    const usedCount = arr.filter((x) => x.status === "used").length;
    if (usedCount >= 2) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user_id)
        .maybeSingle();
      signals.push({
        categoria: "loyalty_abuse",
        severidade: "high",
        titulo: "Múltiplos resgates de corte grátis usados",
        descricao: `${usedCount} resgates marcados como usados na janela.`,
        cliente_id: user_id,
        cliente_nome: (prof as any)?.nome,
        evidencias: { used: usedCount, ids: arr.map((x) => x.id) },
      });
    }
  }

  // 3) Tentativas de login falhas (área financeira / TI)
  const { data: fin } = await supabase
    .from("financeiro_auth_attempts")
    .select("id, ip_address, user_agent, attempted_at, success")
    .gte("attempted_at", sinceIso)
    .eq("success", false)
    .limit(500);
  if ((fin?.length || 0) >= 5) {
    signals.push({
      categoria: "auth_bruteforce",
      severidade: "critical",
      titulo: "Tentativas de acesso negadas na área financeira",
      descricao: `${fin!.length} falhas de autenticação financeira em 30min.`,
      evidencias: {
        total: fin!.length,
        ips: Array.from(new Set(fin!.map((x: any) => x.ip_address))).slice(0, 10),
      },
    });
  }

  // 4) Múltiplos dispositivos por cliente
  const { data: devs } = await supabase
    .from("dispositivos_conectados")
    .select("user_id, fingerprint, created_at")
    .gte("created_at", sinceIso)
    .limit(500);
  const devByUser = new Map<string, Set<string>>();
  (devs || []).forEach((d: any) => {
    const s = devByUser.get(d.user_id) || new Set();
    s.add(d.fingerprint);
    devByUser.set(d.user_id, s);
  });
  for (const [user_id, set] of devByUser) {
    if (set.size >= 3) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user_id)
        .maybeSingle();
      signals.push({
        categoria: "device_anomaly",
        severidade: "medium",
        titulo: "Cliente acessando de muitos dispositivos diferentes",
        descricao: `${set.size} fingerprints distintos em 30min.`,
        cliente_id: user_id,
        cliente_nome: (prof as any)?.nome,
        evidencias: { dispositivos: set.size },
      });
    }
  }

  // 5) Cancelamentos repetidos do mesmo cliente
  const { data: cancels } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, status, updated_at")
    .eq("status", "cancelado")
    .gte("updated_at", sinceIso)
    .limit(500);
  const cByUser = new Map<string, number>();
  (cancels || []).forEach((c: any) => {
    if (!c.cliente_id) return;
    cByUser.set(c.cliente_id, (cByUser.get(c.cliente_id) || 0) + 1);
  });
  for (const [user_id, n] of cByUser) {
    if (n >= 3) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user_id)
        .maybeSingle();
      signals.push({
        categoria: "cancel_pattern",
        severidade: "medium",
        titulo: "Cliente cancelando agendamentos em série",
        descricao: `${n} cancelamentos em 30min.`,
        cliente_id: user_id,
        cliente_nome: (prof as any)?.nome,
        evidencias: { cancelamentos: n },
      });
    }
  }

  // 6) Erros recentes registrados no sistema
  const { data: errs } = await supabase
    .from("system_logs")
    .select("id, level, category, message, created_at")
    .eq("level", "error")
    .gte("created_at", sinceIso)
    .limit(50);
  if ((errs?.length || 0) >= 5) {
    signals.push({
      categoria: "system_errors",
      severidade: (errs!.length >= 20 ? "high" : "medium"),
      titulo: "Pico de erros no sistema",
      descricao: `${errs!.length} erros registrados em system_logs.`,
      evidencias: {
        total: errs!.length,
        amostra: errs!.slice(0, 5).map((e: any) => ({
          categoria: e.category,
          msg: (e.message || "").slice(0, 200),
        })),
      },
    });
  }

  return signals;
}

async function summarizeWithAI(signal: Signal): Promise<string> {
  if (!LOVABLE_API_KEY) return signal.descricao;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é uma IA de segurança do app DUB. Receba um sinal suspeito e gere um alerta CURTO (máx 2 linhas, em PT-BR) explicando o risco e sugerindo ação imediata. Seja direto e agressivo. Sem emojis.",
          },
          {
            role: "user",
            content: JSON.stringify(signal),
          },
        ],
      }),
    });
    if (!res.ok) return signal.descricao;
    const j = await res.json();
    return j?.choices?.[0]?.message?.content?.trim?.() || signal.descricao;
  } catch {
    return signal.descricao;
  }
}

async function sendAlert(
  supabase: ReturnType<typeof createClient>,
  alertId: string,
  signal: Signal,
  resumoIa: string,
) {
  const msg =
    `🚨 ALERTA DE SEGURANÇA — DUB\n` +
    `Severidade: ${signal.severidade.toUpperCase()}\n` +
    `Categoria: ${signal.categoria}\n` +
    (signal.cliente_nome ? `Cliente: ${signal.cliente_nome}\n` : "") +
    `\n${signal.titulo}\n${resumoIa}\n` +
    `\nID alerta: ${alertId}`;

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-webhook-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        evento: "ai_security_alert",
        evento_id: alertId,
        cliente_nome: ALERT_NAME,
        cliente_telefone: ALERT_PHONE,
        mensagem: msg,
        detalhes: {
          severidade: signal.severidade,
          categoria: signal.categoria,
          cliente_envolvido: signal.cliente_nome || null,
          cliente_id: signal.cliente_id || null,
          evidencias: signal.evidencias,
        },
      }),
    });
    const ok = r.ok;
    await supabase
      .from("ai_security_alerts")
      .update({
        enviado: ok,
        enviado_em: ok ? new Date().toISOString() : null,
        erro_envio: ok ? null : `HTTP ${r.status}`,
      })
      .eq("id", alertId);
    return ok;
  } catch (e) {
    await supabase
      .from("ai_security_alerts")
      .update({ enviado: false, erro_envio: String(e) })
      .eq("id", alertId);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: any = {};
  try {
    body = await req.json();
  } catch {/* cron sends empty */}

  const isTest = body?.test === true;
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  let signals: Signal[] = [];
  if (isTest) {
    signals = [
      {
        categoria: "test_fire",
        severidade: "critical",
        titulo: "Teste de disparo da IA de segurança",
        descricao:
          "Este é um disparo de teste. Confirma que o monitoramento, a IA e o webhook do WhatsApp estão funcionando.",
        cliente_nome: "TESTE",
        evidencias: { test: true, at: new Date().toISOString() },
      },
    ];
  } else {
    signals = await collectSignals(supabase, since);
  }

  const results: any[] = [];
  for (const sig of signals) {
    // dedupe — não reenvia o mesmo alerta pro mesmo cliente nas últimas 2h
    const dedupeWindow = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    let dq = supabase
      .from("ai_security_alerts")
      .select("id")
      .eq("categoria", sig.categoria)
      .gte("created_at", dedupeWindow);
    if (sig.cliente_id) dq = dq.eq("cliente_id", sig.cliente_id);
    const { data: dupes } = await dq.limit(1);
    if (!isTest && (dupes?.length || 0) > 0) {
      results.push({ skipped: true, categoria: sig.categoria });
      continue;
    }

    const resumo = await summarizeWithAI(sig);
    const { data: ins, error: insErr } = await supabase
      .from("ai_security_alerts")
      .insert({
        categoria: sig.categoria,
        severidade: sig.severidade,
        titulo: sig.titulo,
        descricao: sig.descricao,
        resumo_ia: resumo,
        cliente_id: sig.cliente_id || null,
        cliente_nome: sig.cliente_nome || null,
        evidencias: sig.evidencias,
      })
      .select("id")
      .single();

    if (insErr || !ins) {
      results.push({ error: insErr?.message });
      continue;
    }
    const sent = await sendAlert(supabase, (ins as any).id, sig, resumo);
    results.push({ id: (ins as any).id, categoria: sig.categoria, sent });
  }

  await supabase
    .from("ai_monitor_state")
    .upsert({
      key: "last_scan",
      last_run_at: new Date().toISOString(),
      payload: { signals_count: signals.length, results },
      updated_at: new Date().toISOString(),
    });

  return new Response(
    JSON.stringify({ ok: true, scanned_since: since, signals: signals.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
