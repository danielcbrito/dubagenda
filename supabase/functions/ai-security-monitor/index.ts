// ai-security-monitor — Agente de IA em TEMPO REAL que monitora o app
// procurando burlações, bugs e comportamento suspeito. Envia alertas
// via WhatsApp usando o MESMO fluxo dos disparos de agendamento
// (send-webhook-event → instância principal do tenant DUB).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Destinatário Daniel Brito (admin DUB) — pode ser sobrescrito por secret
const ALERT_PHONE = Deno.env.get("ALERT_RECIPIENT_PHONE") || "11952160719";
const ALERT_NAME = "Daniel Brito";
// Tenant da Barbearia DUB → usado para escolher a instância principal
// de WhatsApp (mesmo fluxo de agendamento_confirmado).
const DUB_TENANT_ID = "73d61f2f-b369-41f3-8915-8e6de52d6378";

// Dedupe curto (60s) para alertas em tempo real sem flood.
const DEDUPE_SECONDS = 60;
// Janela agressiva de varredura (últimos 5 min — pega tudo recente).
const SCAN_WINDOW_MIN = 5;

interface Signal {
  categoria: string;
  severidade: "low" | "medium" | "high" | "critical";
  titulo: string;
  descricao: string;
  cliente_id?: string;
  cliente_nome?: string;
  evidencias: Record<string, unknown>;
}

type SB = ReturnType<typeof createClient>;

async function profileName(supabase: SB, id?: string | null) {
  if (!id) return undefined;
  const { data } = await supabase.from("profiles").select("nome").eq("id", id).maybeSingle();
  return (data as any)?.nome as string | undefined;
}

// ============== COLETORES POR TIPO DE BURLA ==============

async function sigBookingFlood(supabase: SB, sinceIso: string): Promise<Signal[]> {
  const { data } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, created_at")
    .gte("created_at", sinceIso)
    .limit(1000);
  const map = new Map<string, any[]>();
  (data || []).forEach((a: any) => {
    if (!a.cliente_id) return;
    const arr = map.get(a.cliente_id) || [];
    arr.push(a);
    map.set(a.cliente_id, arr);
  });
  const out: Signal[] = [];
  for (const [cid, arr] of map) {
    if (arr.length >= 2) {
      out.push({
        categoria: "booking_flood",
        severidade: arr.length >= 4 ? "high" : "medium",
        titulo: "Cliente criou múltiplos agendamentos rapidamente",
        descricao: `${arr.length} agendamentos em ${SCAN_WINDOW_MIN} min.`,
        cliente_id: cid,
        cliente_nome: await profileName(supabase, cid),
        evidencias: { quantidade: arr.length, ids: arr.map((x) => x.id) },
      });
    }
  }
  return out;
}

async function sigLoyaltyAbuse(supabase: SB, sinceIso: string): Promise<Signal[]> {
  const { data } = await supabase
    .from("resgates")
    .select("id, user_id, status, appointment_id, created_at")
    .gte("created_at", sinceIso)
    .limit(500);
  const map = new Map<string, any[]>();
  (data || []).forEach((r: any) => {
    const arr = map.get(r.user_id) || [];
    arr.push(r);
    map.set(r.user_id, arr);
  });
  const out: Signal[] = [];
  for (const [uid, arr] of map) {
    const used = arr.filter((x) => x.status === "used").length;
    const avail = arr.filter((x) => x.status === "available").length;
    if (used >= 2 || avail >= 2) {
      out.push({
        categoria: "loyalty_abuse",
        severidade: "high",
        titulo: "Possível abuso do corte grátis",
        descricao: `${used} resgates usados / ${avail} disponíveis na janela.`,
        cliente_id: uid,
        cliente_nome: await profileName(supabase, uid),
        evidencias: { used, available: avail, ids: arr.map((x) => x.id) },
      });
    }
  }
  return out;
}

async function sigAuthBruteforce(supabase: SB, sinceIso: string): Promise<Signal[]> {
  const { data } = await supabase
    .from("financeiro_auth_attempts")
    .select("id, ip_address, attempted_at, success")
    .gte("attempted_at", sinceIso)
    .eq("success", false)
    .limit(500);
  if ((data?.length || 0) < 3) return [];
  return [{
    categoria: "auth_bruteforce",
    severidade: "critical",
    titulo: "Tentativas de acesso negadas (área financeira)",
    descricao: `${data!.length} falhas em ${SCAN_WINDOW_MIN} min.`,
    evidencias: {
      total: data!.length,
      ips: Array.from(new Set(data!.map((x: any) => x.ip_address))).slice(0, 10),
    },
  }];
}

async function sigDeviceAnomaly(supabase: SB, sinceIso: string): Promise<Signal[]> {
  const { data } = await supabase
    .from("dispositivos_conectados")
    .select("user_id, fingerprint, created_at")
    .gte("created_at", sinceIso)
    .limit(500);
  const map = new Map<string, Set<string>>();
  (data || []).forEach((d: any) => {
    const s = map.get(d.user_id) || new Set<string>();
    s.add(d.fingerprint);
    map.set(d.user_id, s);
  });
  const out: Signal[] = [];
  for (const [uid, set] of map) {
    if (set.size >= 2) {
      out.push({
        categoria: "device_anomaly",
        severidade: set.size >= 3 ? "high" : "medium",
        titulo: "Cliente em múltiplos dispositivos",
        descricao: `${set.size} fingerprints distintos em ${SCAN_WINDOW_MIN} min.`,
        cliente_id: uid,
        cliente_nome: await profileName(supabase, uid),
        evidencias: { dispositivos: set.size },
      });
    }
  }
  return out;
}

async function sigCancelPattern(supabase: SB, sinceIso: string): Promise<Signal[]> {
  const { data } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, status, updated_at")
    .eq("status", "cancelado")
    .gte("updated_at", sinceIso)
    .limit(500);
  const map = new Map<string, number>();
  (data || []).forEach((c: any) => {
    if (!c.cliente_id) return;
    map.set(c.cliente_id, (map.get(c.cliente_id) || 0) + 1);
  });
  const out: Signal[] = [];
  for (const [uid, n] of map) {
    if (n >= 2) {
      out.push({
        categoria: "cancel_pattern",
        severidade: n >= 4 ? "high" : "medium",
        titulo: "Cancelamentos em série",
        descricao: `${n} cancelamentos em ${SCAN_WINDOW_MIN} min.`,
        cliente_id: uid,
        cliente_nome: await profileName(supabase, uid),
        evidencias: { cancelamentos: n },
      });
    }
  }
  return out;
}

async function sigSystemErrors(supabase: SB, sinceIso: string): Promise<Signal[]> {
  const { data } = await supabase
    .from("system_logs")
    .select("id, level, category, message, created_at")
    .eq("level", "error")
    .gte("created_at", sinceIso)
    .limit(50);
  if ((data?.length || 0) < 3) return [];
  return [{
    categoria: "system_errors",
    severidade: data!.length >= 15 ? "high" : "medium",
    titulo: "Pico de erros no sistema",
    descricao: `${data!.length} erros registrados.`,
    evidencias: {
      total: data!.length,
      amostra: data!.slice(0, 5).map((e: any) => ({
        categoria: e.category,
        msg: (e.message || "").slice(0, 200),
      })),
    },
  }];
}

async function sigPaymentAnomaly(supabase: SB, sinceIso: string): Promise<Signal[]> {
  // Múltiplos PIX pendentes do mesmo cliente
  const { data } = await supabase
    .from("pending_bookings")
    .select("id, cliente_id, status, created_at")
    .gte("created_at", sinceIso)
    .limit(500);
  const map = new Map<string, number>();
  (data || []).forEach((p: any) => {
    if (!p.cliente_id) return;
    map.set(p.cliente_id, (map.get(p.cliente_id) || 0) + 1);
  });
  const out: Signal[] = [];
  for (const [uid, n] of map) {
    if (n >= 3) {
      out.push({
        categoria: "payment_anomaly",
        severidade: "medium",
        titulo: "Múltiplas reservas/pagamentos pendentes",
        descricao: `${n} pending bookings em ${SCAN_WINDOW_MIN} min.`,
        cliente_id: uid,
        cliente_nome: await profileName(supabase, uid),
        evidencias: { pendentes: n },
      });
    }
  }
  return out;
}

const COLLECTORS: Record<
  string,
  (s: SB, since: string) => Promise<Signal[]>
> = {
  booking_flood: sigBookingFlood,
  loyalty_abuse: sigLoyaltyAbuse,
  auth_bruteforce: sigAuthBruteforce,
  device_anomaly: sigDeviceAnomaly,
  cancel_pattern: sigCancelPattern,
  system_errors: sigSystemErrors,
  payment_anomaly: sigPaymentAnomaly,
};

async function collectAll(supabase: SB, sinceIso: string): Promise<Signal[]> {
  const all = await Promise.all(
    Object.values(COLLECTORS).map((fn) => fn(supabase, sinceIso).catch(() => [])),
  );
  return all.flat();
}

// ============== IA RESUMIDORA ==============

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
              "Você é uma IA de segurança AGRESSIVA do app DUB. Gere alerta CURTO (máx 2 linhas, PT-BR), direto, com risco + ação imediata. Sem emojis.",
          },
          { role: "user", content: JSON.stringify(signal) },
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

// ============== ENVIO VIA MESMO FLUXO DE AGENDAMENTO ==============

async function sendAlert(
  supabase: SB,
  alertId: string,
  signal: Signal,
  resumoIa: string,
) {
  const msg =
    `🚨 *ALERTA DE SEGURANÇA — DUB*\n` +
    `Severidade: ${signal.severidade.toUpperCase()} | ${signal.categoria}\n` +
    (signal.cliente_nome ? `Cliente: ${signal.cliente_nome}\n` : "") +
    `\n${signal.titulo}\n${resumoIa}\n` +
    `\nID: ${alertId.slice(0, 8)}`;

  try {
    // Usa o MESMO endpoint que dispara WhatsApp de agendamentos.
    // evento=disparo_mensagem → preserva nossa `mensagem` (sem template).
    // detalhes.tenant_id=DUB → seleciona instância principal do tenant.
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-webhook-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        evento: "disparo_mensagem",
        evento_id: alertId,
        cliente_nome: ALERT_NAME,
        cliente_telefone: ALERT_PHONE,
        mensagem: msg,
        detalhes: {
          tenant_id: DUB_TENANT_ID,
          tipo: "ai_security_alert",
          severidade: signal.severidade,
          categoria: signal.categoria,
          cliente_envolvido: signal.cliente_nome || null,
          cliente_id: signal.cliente_id || null,
          evidencias: signal.evidencias,
        },
      }),
    });
    const ok = r.ok;
    const respText = ok ? null : await r.text().catch(() => null);
    await supabase
      .from("ai_security_alerts")
      .update({
        enviado: ok,
        enviado_em: ok ? new Date().toISOString() : null,
        erro_envio: ok ? null : `HTTP ${r.status} ${respText?.slice(0, 200) || ""}`,
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

async function processSignals(
  supabase: SB,
  signals: Signal[],
  opts: { skipDedupe?: boolean } = {},
) {
  const results: any[] = [];
  for (const sig of signals) {
    if (!opts.skipDedupe) {
      const dedupeFrom = new Date(Date.now() - DEDUPE_SECONDS * 1000).toISOString();
      let dq = supabase
        .from("ai_security_alerts")
        .select("id")
        .eq("categoria", sig.categoria)
        .gte("created_at", dedupeFrom);
      if (sig.cliente_id) dq = dq.eq("cliente_id", sig.cliente_id);
      const { data: dupes } = await dq.limit(1);
      if ((dupes?.length || 0) > 0) {
        results.push({ skipped: true, categoria: sig.categoria });
        continue;
      }
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
  return results;
}

function buildTestSignal(type: string): Signal {
  const base: Signal = {
    categoria: type,
    severidade: "high",
    titulo: `Teste — ${type}`,
    descricao: `Disparo de teste do tipo ${type}.`,
    cliente_nome: "TESTE",
    evidencias: { test: true, at: new Date().toISOString() },
  };
  if (type === "test_fire") base.severidade = "critical";
  return base;
}

// ============== HANDLER ==============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: any = {};
  try { body = await req.json(); } catch { /* cron sends empty */ }

  // Teste por tipo de burla:
  // { test: true } → genérico
  // { test_type: "loyalty_abuse" } → fogo direcionado
  // { test_all: true } → dispara 1 alerta de cada categoria
  if (body?.test === true || body?.test_type || body?.test_all) {
    let signals: Signal[];
    if (body?.test_all) {
      const types = [...Object.keys(COLLECTORS), "test_fire"];
      signals = types.map(buildTestSignal);
    } else {
      signals = [buildTestSignal(body?.test_type || "test_fire")];
    }
    const results = await processSignals(supabase, signals, { skipDedupe: true });
    return new Response(
      JSON.stringify({ ok: true, mode: "test", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Modo tempo real: loop interno enquanto durar o invocation (cron a cada 1min).
  // Faz N ticks com intervalo curto cobrindo a janela até o próximo cron.
  const realtime = body?.realtime === true || body?.source === "cron";
  const ticks = Math.max(1, Math.min(20, Number(body?.ticks) || (realtime ? 12 : 1)));
  const intervalMs = Math.max(1000, Math.min(10000, Number(body?.interval_ms) || 4000));

  const aggregate: any[] = [];
  let totalSignals = 0;
  for (let i = 0; i < ticks; i++) {
    const since = new Date(Date.now() - SCAN_WINDOW_MIN * 60 * 1000).toISOString();
    const signals = await collectAll(supabase, since);
    totalSignals += signals.length;
    if (signals.length) {
      const r = await processSignals(supabase, signals);
      aggregate.push({ tick: i, count: signals.length, results: r });
    }
    if (i < ticks - 1) {
      await new Promise((res) => setTimeout(res, intervalMs));
    }
  }

  await supabase.from("ai_monitor_state").upsert({
    key: "last_scan",
    last_run_at: new Date().toISOString(),
    payload: { ticks, intervalMs, totalSignals, sample: aggregate.slice(0, 3) },
    updated_at: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({ ok: true, mode: realtime ? "realtime-loop" : "single", ticks, totalSignals, aggregate }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
