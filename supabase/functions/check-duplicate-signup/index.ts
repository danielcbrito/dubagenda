import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailSchema = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normaliza telefone BR para formato canônico local (10 ou 11 dígitos, sem DDI).
 * Remove DDI 55, insere o "9" de celular quando faltando (números começando 6-9 com 8 dígitos).
 * Retorna null se o número não bater com padrão BR.
 */
function normalizeBrPhone(input: string): string | null {
  let v = String(input || "").replace(/\D/g, "");
  if (!v) return null;
  if ((v.length === 12 || v.length === 13) && v.startsWith("55")) {
    v = v.slice(2);
  }
  if (v.length !== 10 && v.length !== 11) return null;
  const ddd = parseInt(v.slice(0, 2), 10);
  if (isNaN(ddd) || ddd < 11 || ddd > 99) return null;
  const rest = v.slice(2);
  if (rest.length === 9) {
    if (rest[0] !== "9") return null;
    return v;
  }
  // rest.length === 8
  if (["6", "7", "8", "9"].includes(rest[0])) {
    return v.slice(0, 2) + "9" + rest;
  }
  return v; // fixo
}

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
      const normalized = normalizeBrPhone(String(telefone));
      if (normalized) {
        // Busca por qualquer variação salva (normalizada ou legada com/sem 55)
        const variants = Array.from(new Set([
          normalized,
          "55" + normalized,
        ]));
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .in("telefone", variants)
          .limit(1);

        if (data && data.length > 0) {
          duplicates.push("telefone");
        }
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

        // Camada extra: identidade já usada em conta antiga (mesmo deletada)
        try {
          const { data: dup } = await supabase.rpc("validar_identidade_duplicada", {
            p_profile_id: foundUserId,
          });
          if (dup === true && !duplicates.includes("email")) {
            duplicates.push("identidade_previa");
          }
        } catch (e) {
          console.warn("validar_identidade_duplicada failed:", e);
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
