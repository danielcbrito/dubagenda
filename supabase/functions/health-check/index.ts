import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const checks = [];

    // Check 1: Database
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("count").limit(1).single();
      const dbTime = Date.now() - dbStart;
      
      checks.push({
        service_name: "database",
        status: error ? "degraded" : "healthy",
        response_time_ms: dbTime,
        error_message: error?.message,
      });
    } catch (error: any) {
      checks.push({
        service_name: "database",
        status: "down",
        response_time_ms: Date.now() - dbStart,
        error_message: error?.message || "Unknown error",
      });
    }

    // Check 2: Asaas API
    const asaasStart = Date.now();
    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    if (asaasKey) {
      try {
        const response = await fetch("https://api.asaas.com/v3/customers?limit=1", {
          headers: { "access_token": asaasKey },
        });
        const asaasTime = Date.now() - asaasStart;
        
        checks.push({
          service_name: "asaas",
          status: response.ok ? "healthy" : "degraded",
          response_time_ms: asaasTime,
          error_message: response.ok ? null : `HTTP ${response.status}`,
        });
      } catch (error: any) {
        checks.push({
          service_name: "asaas",
          status: "down",
          response_time_ms: Date.now() - asaasStart,
          error_message: error?.message || "Unknown error",
        });
      }
    }

    // Check 3: Google Calendar
    const googleStart = Date.now();
    const googleRefreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
    if (googleRefreshToken) {
      try {
        const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
          headers: { "Authorization": `Bearer ${googleRefreshToken}` },
        });
        const googleTime = Date.now() - googleStart;
        
        checks.push({
          service_name: "google_calendar",
          status: response.ok ? "healthy" : "degraded",
          response_time_ms: googleTime,
          error_message: response.ok ? null : `HTTP ${response.status}`,
        });
      } catch (error: any) {
        checks.push({
          service_name: "google_calendar",
          status: "down",
          response_time_ms: Date.now() - googleStart,
          error_message: error?.message || "Unknown error",
        });
      }
    }

    // Salvar no banco
    for (const check of checks) {
      await supabase.from("system_health_checks").upsert({
        ...check,
        last_check_at: new Date().toISOString(),
      }, {
        onConflict: "service_name",
      });
    }

    return new Response(
      JSON.stringify({ checks }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
