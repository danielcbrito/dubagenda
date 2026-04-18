// Edge Function: efi-manage-credentials
// Admin-only: cadastra credenciais Efí (criptografa .p12 + secrets), testa conexão e testa chave PIX (R$ 0,01).
// Actions: "save" | "test-connection" | "test-pix" | "activate"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EFI_API_PROD = "https://pix.api.efipay.com.br";
const EFI_API_HOMOLOG = "https://pix-h.api.efipay.com.br";

/* ================= AES-GCM ================= */
async function importKey(rawKeyB64: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(rawKeyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("EFI_ENCRYPTION_KEY deve ser 32 bytes em base64");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, usages);
}

async function encryptField(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc));
  // Separar tag (últimos 16 bytes) do ciphertext
  const tag = ct.slice(ct.length - 16);
  const data = ct.slice(0, ct.length - 16);
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return { encrypted: b64(data), iv: b64(iv), authTag: b64(tag) };
}

async function decryptField(key: CryptoKey, encB64: string, ivB64: string, tagB64: string) {
  const ct = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(tagB64), (c) => c.charCodeAt(0));
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return new TextDecoder().decode(plain);
}

/* ================= P12 → PEM ================= */
// Converte um buffer .p12 + senha para PEM bundle (cert + key) usando node-forge
async function p12ToPem(p12B64: string, password: string): Promise<string> {
  // @ts-ignore - dynamic import via esm.sh
  const forge = await import("https://esm.sh/node-forge@1.3.1");
  const p12Der = forge.util.decode64(p12B64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  let certPem = "";
  let keyPem = "";
  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        certPem += forge.pki.certificateToPem(safeBag.cert);
      } else if (
        (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
          safeBag.type === forge.pki.oids.keyBag) &&
        safeBag.key
      ) {
        keyPem += forge.pki.privateKeyToPem(safeBag.key);
      }
    }
  }
  if (!certPem || !keyPem) throw new Error("Não foi possível extrair certificado e chave do .p12 (senha incorreta?)");
  return certPem + keyPem;
}

/* ================= Efí ================= */
async function efiAuth(baseUrl: string, clientId: string, clientSecret: string, pem: string): Promise<string> {
  const client = (Deno as any).createHttpClient({ cert: pem, key: pem });
  const auth = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    // @ts-ignore
    client,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!resp.ok) throw new Error(`Auth Efí: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.access_token as string;
}

async function efiSendPix(
  baseUrl: string,
  token: string,
  pem: string,
  payerKey: string,
  receiverKey: string,
  valor: number,
): Promise<{ e2eId: string; raw: any }> {
  const client = (Deno as any).createHttpClient({ cert: pem, key: pem });
  const idEnvio = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const body = {
    valor: valor.toFixed(2),
    pagador: { chave: payerKey, infoPagador: "Teste DUB" },
    favorecido: { chave: receiverKey },
  };
  const resp = await fetch(`${baseUrl}/v3/gn/pix/${idEnvio}`, {
    method: "PUT",
    // @ts-ignore
    client,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Envio PIX falhou: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return { e2eId: data.e2eId ?? idEnvio, raw: data };
}

/* ================= Handler ================= */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const encKeyB64 = Deno.env.get("EFI_ENCRYPTION_KEY")!;

    if (!encKeyB64) {
      return new Response(JSON.stringify({ error: "EFI_ENCRYPTION_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth + role check
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action: string = body.action;
    const barbeiroId: string = body.barbeiro_id;

    if (!action || !barbeiroId) {
      return new Response(JSON.stringify({ error: "action e barbeiro_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encKeyEnc = await importKey(encKeyB64, ["encrypt"]);
    const encKeyDec = await importKey(encKeyB64, ["decrypt"]);

    /* ---------- SAVE ---------- */
    if (action === "save") {
      const { client_id, client_secret, cert_p12_base64, cert_password, pix_key, ambiente } = body;
      if (!client_id || !client_secret || !cert_p12_base64 || !cert_password || !pix_key) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Converter .p12 → PEM (valida senha)
      let pem: string;
      try {
        pem = await p12ToPem(cert_p12_base64, cert_password);
      } catch (e: any) {
        return new Response(JSON.stringify({ error: `Falha ao ler .p12: ${e.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Criptografar campos
      const pemB64 = btoa(pem);
      const [encId, encSecret, encCert, encPwd] = await Promise.all([
        encryptField(encKeyEnc, client_id),
        encryptField(encKeyEnc, client_secret),
        encryptField(encKeyEnc, pemB64),
        encryptField(encKeyEnc, cert_password),
      ]);

      const payload = {
        barbeiro_id: barbeiroId,
        ambiente: ambiente === "homolog" ? "homolog" : "prod",
        pix_key,
        ativo: false,
        client_id_encrypted: encId.encrypted, client_id_iv: encId.iv, client_id_auth_tag: encId.authTag,
        client_secret_encrypted: encSecret.encrypted, client_secret_iv: encSecret.iv, client_secret_auth_tag: encSecret.authTag,
        cert_p12_encrypted: encCert.encrypted, cert_p12_iv: encCert.iv, cert_p12_auth_tag: encCert.authTag,
        cert_password_encrypted: encPwd.encrypted, cert_password_iv: encPwd.iv, cert_password_auth_tag: encPwd.authTag,
        test_connection_ok: false, test_pix_ok: false,
      };

      const { error: upErr } = await admin
        .from("efi_credenciais")
        .upsert(payload, { onConflict: "barbeiro_id" });

      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, message: "Credenciais salvas. Execute os testes." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ---------- Carregar credenciais ---------- */
    const { data: cred } = await admin.from("efi_credenciais").select("*").eq("barbeiro_id", barbeiroId).maybeSingle();
    if (!cred) {
      return new Response(JSON.stringify({ error: "Credenciais não cadastradas" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const baseUrl = cred.ambiente === "homolog" ? EFI_API_HOMOLOG : EFI_API_PROD;
    const [clientId, clientSecret, pemB64] = await Promise.all([
      decryptField(encKeyDec, cred.client_id_encrypted, cred.client_id_iv, cred.client_id_auth_tag),
      decryptField(encKeyDec, cred.client_secret_encrypted, cred.client_secret_iv, cred.client_secret_auth_tag),
      decryptField(encKeyDec, cred.cert_p12_encrypted, cred.cert_p12_iv, cred.cert_p12_auth_tag),
    ]);
    const pem = atob(pemB64);

    /* ---------- TEST CONNECTION ---------- */
    if (action === "test-connection") {
      try {
        const token = await efiAuth(baseUrl, clientId, clientSecret, pem);
        await admin.from("efi_credenciais").update({
          test_connection_ok: true, test_connection_at: new Date().toISOString(),
        }).eq("barbeiro_id", barbeiroId);
        return new Response(JSON.stringify({ ok: true, token_preview: token.slice(0, 12) + "..." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await admin.from("efi_credenciais").update({
          test_connection_ok: false, test_connection_at: new Date().toISOString(),
        }).eq("barbeiro_id", barbeiroId);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    /* ---------- TEST PIX (R$ 0,01 auto-envio) ---------- */
    if (action === "test-pix") {
      try {
        const token = await efiAuth(baseUrl, clientId, clientSecret, pem);
        const result = await efiSendPix(baseUrl, token, pem, cred.pix_key, cred.pix_key, 0.01);
        await admin.from("efi_credenciais").update({
          test_pix_ok: true, test_pix_at: new Date().toISOString(), test_pix_e2e_id: result.e2eId,
        }).eq("barbeiro_id", barbeiroId);
        return new Response(JSON.stringify({ ok: true, e2e_id: result.e2eId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await admin.from("efi_credenciais").update({
          test_pix_ok: false, test_pix_at: new Date().toISOString(),
        }).eq("barbeiro_id", barbeiroId);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    /* ---------- ACTIVATE ---------- */
    if (action === "activate") {
      if (!cred.test_connection_ok || !cred.test_pix_ok) {
        return new Response(JSON.stringify({ error: "Execute e aprove ambos os testes antes de ativar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("efi_credenciais").update({
        ativo: true, activated_at: new Date().toISOString(), activated_by: userId,
      }).eq("barbeiro_id", barbeiroId);
      return new Response(JSON.stringify({ ok: true, message: "Conta PIX ativada!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ---------- DEACTIVATE ---------- */
    if (action === "deactivate") {
      await admin.from("efi_credenciais").update({ ativo: false }).eq("barbeiro_id", barbeiroId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("efi-manage-credentials:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
