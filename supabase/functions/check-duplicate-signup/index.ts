import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, telefone, email } = await req.json();

    if (!cpf && !telefone && !email) {
      return new Response(
        JSON.stringify({ error: "Dados insuficientes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const duplicates: string[] = [];

    // Check CPF
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, "");
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("cpf", cleanCpf)
        .limit(1);
      if (data && data.length > 0) {
        duplicates.push("cpf");
      }
    }

    // Check phone
    if (telefone) {
      const cleanPhone = telefone.replace(/\D/g, "");
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("telefone", cleanPhone)
        .limit(1);
      if (data && data.length > 0) {
        duplicates.push("telefone");
      }
    }

    // Check email via auth (Supabase already blocks duplicate emails,
    // but we check proactively for a better UX message)
    if (email) {
      const { data } = await supabase.auth.admin.listUsers();
      const emailExists = data?.users?.some(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (emailExists) {
        duplicates.push("email");
      }
    }

    return new Response(
      JSON.stringify({ duplicates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-duplicate-signup error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
