import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailSchema = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    let duplicateClientAccount = false;

    if (cpf) {
      const cleanCpf = String(cpf).replace(/\D/g, "");
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("cpf", cleanCpf)
        .limit(1);

      if (data && data.length > 0) {
        duplicates.push("cpf");
      }
    }

    if (telefone) {
      const cleanPhone = String(telefone).replace(/\D/g, "");
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("telefone", cleanPhone)
        .limit(1);

      if (data && data.length > 0) {
        duplicates.push("telefone");
      }
    }

    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();

      if (!emailSchema.test(normalizedEmail)) {
        return new Response(
          JSON.stringify({ error: "Email inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let page = 1;
      const perPage = 200;
      let foundUserId: string | null = null;
      let hasMore = true;

      while (hasMore && !foundUserId) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

        if (error) {
          throw error;
        }

        const users = data?.users ?? [];
        const matchedUser = users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);

        if (matchedUser) {
          foundUserId = matchedUser.id;
          break;
        }

        hasMore = users.length === perPage;
        page += 1;
      }

      if (foundUserId) {
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", foundUserId);

        if (rolesError) {
          throw rolesError;
        }

        duplicateClientAccount = (roles ?? []).some((entry) => entry.role === "cliente");

        if (duplicateClientAccount) {
          duplicates.push("email");
        }
      }
    }

    return new Response(
      JSON.stringify({ duplicates, duplicateClientAccount }),
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
