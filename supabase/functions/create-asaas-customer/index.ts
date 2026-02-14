import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY não configurada");

    const body = await req.json();
    const { action } = body;

    // ── Ação: Criar cliente ──
    if (action === "create_customer") {
      const { name, email, cpfCnpj, phone } = body;

      if (!name || !cpfCnpj) {
        return new Response(
          JSON.stringify({ error: "Nome e CPF/CNPJ são obrigatórios" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const res = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          name,
          email: email || undefined,
          cpfCnpj,
          phone: phone || undefined,
        }),
      });

      const data = await res.json();
      console.log("[create-asaas-customer] Response:", JSON.stringify(data));

      if (data.errors) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar cliente", details: data.errors }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, customer: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ── Ação: Listar clientes ──
    if (action === "list_customers") {
      const res = await fetch(`${ASAAS_BASE_URL}/customers?limit=10`, {
        headers: { access_token: asaasApiKey },
      });
      const data = await res.json();

      return new Response(
        JSON.stringify({ success: true, customers: data.data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida. Use: create_customer, list_customers" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error) {
    console.error("[create-asaas-customer] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
