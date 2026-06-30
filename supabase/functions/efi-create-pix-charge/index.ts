// Edge Function: efi-create-pix-charge
// Cria cobrança PIX dinâmica na conta Efí Bank do barbeiro selecionado.
// Retorna { txid, br_code, qr_code_image, expires_at, charge_id, pending_booking_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EFI_API_PROD = "https://pix.api.efipay.com.br";
const EFI_API_HOMOLOG = "https://pix-h.api.efipay.com.br";

/* ------------------------- AES-GCM helpers ------------------------- */
async function importKey(rawKeyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(rawKeyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error("EFI_ENCRYPTION_KEY deve ser 32 bytes em base64");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

async function decryptField(
  key: CryptoKey,
  encryptedB64: string,
  ivB64: string,
  authTagB64: string,
): Promise<string> {
  const ciphertext = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(authTagB64), (c) => c.charCodeAt(0));
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return new TextDecoder().decode(plain);
}

/* ------------------------- Efí helpers ------------------------- */
async function efiAuth(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  certP12B64: string,
): Promise<string> {
  // Deno fetch não suporta mTLS com cert .p12 nativamente em todos os runtimes.
  // Solução: usar Deno.createHttpClient com certificado client-side via PEM (convertido).
  // Aqui assumimos que o certP12 já foi convertido para PEM no cadastro (formato esperado).
  const certPem = atob(certP12B64); // armazenado já como PEM em base64
  const client = (Deno as any).createHttpClient({
    cert: certPem,
    key: certPem, // PEM bundle contém ambos (cert + private key)
  });
  const auth = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    // @ts-ignore - client é específico do Deno
    client,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Efí auth falhou: ${resp.status} ${txt}`);
  }
  const data = await resp.json();
  return data.access_token as string;
}

async function efiCreateCharge(
  baseUrl: string,
  accessToken: string,
  certPemB64: string,
  payload: {
    valor: number;
    chave: string;
    descricao: string;
    expiracao: number;
    txid: string;
  },
): Promise<any> {
  const certPem = atob(certPemB64);
  const client = (Deno as any).createHttpClient({ cert: certPem, key: certPem });
  const body = {
    calendario: { expiracao: payload.expiracao },
    valor: { original: payload.valor.toFixed(2) },
    chave: payload.chave,
    solicitacaoPagador: payload.descricao.slice(0, 140),
  };
  const resp = await fetch(`${baseUrl}/v2/cob/${payload.txid}`, {
    method: "PUT",
    // @ts-ignore
    client,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Efí create cob falhou: ${resp.status} ${txt}`);
  }
  return resp.json();
}

async function efiGetQrCode(
  baseUrl: string,
  accessToken: string,
  certPemB64: string,
  locId: number | string,
): Promise<{ qrcode: string; imagemQrcode: string }> {
  const certPem = atob(certPemB64);
  const client = (Deno as any).createHttpClient({ cert: certPem, key: certPem });
  const resp = await fetch(`${baseUrl}/v2/loc/${locId}/qrcode`, {
    method: "GET",
    // @ts-ignore
    client,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Efí qrcode falhou: ${resp.status} ${txt}`);
  }
  return resp.json();
}

/* ------------------------- handler ------------------------- */
function genTxid(): string {
  // Efí exige 26-35 chars alfanuméricos
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const encryptionKeyB64 = Deno.env.get("EFI_ENCRYPTION_KEY")!;

    if (!encryptionKeyB64) {
      return new Response(
        JSON.stringify({ error: "EFI_ENCRYPTION_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Autenticar usuário (cliente)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const {
      barbeiro_id,
      valor,
      descricao,
      servico_id,
      data: bookingDate,
      hora: bookingHora,
      duracao,
      observacoes,
    } = body;

    if (!barbeiro_id || !valor || valor <= 0) {
      return new Response(
        JSON.stringify({ error: "barbeiro_id e valor obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Buscar credenciais Efí do barbeiro
    const { data: cred, error: credErr } = await admin
      .from("efi_credenciais")
      .select("*")
      .eq("barbeiro_id", barbeiro_id)
      .eq("ativo", true)
      .maybeSingle();

    if (credErr || !cred) {
      return new Response(
        JSON.stringify({
          error: "Este profissional não aceita PIX no momento. Escolha outro pagamento.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Descriptografar credenciais
    const key = await importKey(encryptionKeyB64);
    const [clientId, clientSecret, certPemB64] = await Promise.all([
      decryptField(key, cred.client_id_encrypted, cred.client_id_iv, cred.client_id_auth_tag),
      decryptField(key, cred.client_secret_encrypted, cred.client_secret_iv, cred.client_secret_auth_tag),
      decryptField(key, cred.cert_p12_encrypted, cred.cert_p12_iv, cred.cert_p12_auth_tag),
    ]);

    const baseUrl = cred.ambiente === "homolog" ? EFI_API_HOMOLOG : EFI_API_PROD;

    // 3. Criar pending_booking (reserva o slot por 30min)
    let pendingBookingId: string | null = null;
    if (servico_id && bookingDate && bookingHora) {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: pb, error: pbErr } = await admin
        .from("pending_bookings")
        .insert({
          user_id: userId,
          barbeiro_id,
          servico_id,
          data: bookingDate,
          hora: bookingHora,
          duracao: duracao ?? 30,
          preco: valor,
          observacoes: observacoes ?? null,
          payment_method: "pix",
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (pbErr) {
        return new Response(
          JSON.stringify({ error: "Slot indisponível", details: pbErr.message }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      pendingBookingId = pb.id;
    }

    // 4. Auth Efí + criar cobrança
    const accessToken = await efiAuth(baseUrl, clientId, clientSecret, certPemB64);
    const txid = genTxid();
    const charge = await efiCreateCharge(baseUrl, accessToken, certPemB64, {
      valor: Number(valor),
      chave: cred.pix_key,
      descricao: descricao || "Agendamento DUB",
      expiracao: 1800, // 30 min
      txid,
    });

    const locId = charge.loc?.id;
    let qr = { qrcode: "", imagemQrcode: "" };
    if (locId) {
      qr = await efiGetQrCode(baseUrl, accessToken, certPemB64, locId);
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // 5. Persistir cobrança
    const { error: insErr } = await admin.from("efi_pix_charges").insert({
      txid,
      barbeiro_id,
      user_id: userId,
      pending_booking_id: pendingBookingId,
      valor: Number(valor),
      descricao,
      br_code: qr.qrcode,
      qr_code_image: qr.imagemQrcode,
      loc_id: locId,
      chave_pix_destino: cred.pix_key,
      status: "PENDING",
      expires_at: expiresAt,
      raw_charge: charge,
    });
    if (insErr) {
      console.error("Erro ao persistir cobrança:", insErr);
    }

    return new Response(
      JSON.stringify({
        txid,
        br_code: qr.qrcode,
        qr_code_image: qr.imagemQrcode,
        expires_at: expiresAt,
        charge_id: charge.txid ?? txid,
        pending_booking_id: pendingBookingId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("efi-create-pix-charge error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
