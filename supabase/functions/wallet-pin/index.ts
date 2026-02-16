import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "dub_wallet_salt_2025");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, pin, current_pin } = await req.json();

    if (action === "set" || action === "update") {
      if (!pin || pin.length < 4 || pin.length > 6) {
        return new Response(JSON.stringify({ error: "PIN deve ter entre 4 e 6 dígitos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!/^\d+$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN deve conter apenas números" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If updating, verify current PIN first
      if (action === "update") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_pin_hash")
          .eq("id", user.id)
          .single();

        if (profile?.wallet_pin_hash) {
          const currentHash = await hashPin(current_pin || "");
          if (currentHash !== profile.wallet_pin_hash) {
            return new Response(JSON.stringify({ error: "PIN atual incorreto" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      const pinHash = await hashPin(pin);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ wallet_pin_hash: pinHash })
        .eq("id", user.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Erro ao salvar PIN" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_pin_hash")
        .eq("id", user.id)
        .single();

      if (!profile?.wallet_pin_hash) {
        return new Response(JSON.stringify({ valid: true, no_pin: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pinHash = await hashPin(pin || "");
      const valid = pinHash === profile.wallet_pin_hash;

      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_pin_hash")
        .eq("id", user.id)
        .single();

      if (profile?.wallet_pin_hash) {
        const currentHash = await hashPin(current_pin || "");
        if (currentHash !== profile.wallet_pin_hash) {
          return new Response(JSON.stringify({ error: "PIN atual incorreto" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      await supabase
        .from("profiles")
        .update({ wallet_pin_hash: null })
        .eq("id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_pin_hash")
        .eq("id", user.id)
        .single();

      return new Response(JSON.stringify({ has_pin: !!profile?.wallet_pin_hash }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
