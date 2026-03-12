import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: verify caller ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const callerUserId = claimsData.user.id;

    // ── Parse body ──
    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: "appointmentId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Service-role client for privileged operations ──
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch appointment and verify ownership
    const { data: appointment, error: fetchError } = await supabase
      .from("agendamentos")
      .select("id, user_id, status, preco, servico_id, data, hora, barbeiro_id, payment_method, observacoes, is_free")
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appointment) {
      return new Response(
        JSON.stringify({ error: "Agendamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (appointment.user_id !== callerUserId) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para cancelar este agendamento" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Check if cancellable
    const cancellableStatuses = ["pending", "confirmed"];
    if (!cancellableStatuses.includes(appointment.status)) {
      return new Response(
        JSON.stringify({ error: `Agendamento com status '${appointment.status}' não pode ser cancelado` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Cancel the appointment
    const { error: updateError } = await supabase
      .from("agendamentos")
      .update({
        status: "cancelled_by_user",
        visivel_para_usuario: false,
      })
      .eq("id", appointmentId);

    if (updateError) throw updateError;

    // 4. Handle refund → wallet balance (replicates modal logic)
    let refundedAmount = 0;
    const isPaidWithCredit =
      appointment.payment_method === "credit" ||
      appointment.observacoes?.toLowerCase().includes("crédito do app") ||
      appointment.observacoes?.toLowerCase().includes("credito do app");

    const isPaidViaGateway =
      !isPaidWithCredit &&
      (appointment.payment_method === "pix" ||
        appointment.payment_method === "card" ||
        appointment.payment_method === "credit_card");

    const amount = appointment.preco || 0;

    // Determine refund amount
    if (isPaidWithCredit && amount > 0) {
      refundedAmount = amount;
    } else if (amount > 0 && !appointment.is_free) {
      refundedAmount = amount;
    }

    if (refundedAmount > 0) {
      // Get or create wallet balance
      const { data: currentBalance } = await supabase.rpc("get_or_create_wallet_balance", {
        p_user_id: callerUserId,
      });

      const newBalance = (currentBalance || 0) + refundedAmount;
      const { error: walletError } = await supabase
        .from("wallet_balances")
        .update({ balance: newBalance })
        .eq("user_id", callerUserId);

      if (walletError) {
        console.error("Wallet update error:", walletError);
        // Don't fail the entire operation — appointment is already cancelled
      }

      // Record transaction
      const description = isPaidWithCredit
        ? `Estorno de cancelamento - R$ ${refundedAmount.toFixed(2)}`
        : isPaidViaGateway
          ? `Estorno de cancelamento (${appointment.payment_method === "pix" ? "PIX" : "Cartão"}) - R$ ${refundedAmount.toFixed(2)}`
          : `Estorno de cancelamento - R$ ${refundedAmount.toFixed(2)}`;

      await supabase.from("wallet_transactions").insert({
        user_id: callerUserId,
        type: "refund",
        amount: refundedAmount,
        status: "completed",
        description,
      });
    }

    // 5. Create notification
    await supabase.from("notificacoes").insert({
      user_id: callerUserId,
      tipo: "cancelamento",
      titulo: "Agendamento cancelado",
      mensagem: refundedAmount > 0
        ? `Seu agendamento foi cancelado. R$ ${refundedAmount.toFixed(2)} foi adicionado à sua carteira.`
        : "Seu agendamento foi cancelado com sucesso.",
      agendamento_id: appointmentId,
    });

    // 6. Fire-and-forget: dispatch webhook via send-webhook-event
    try {
      // Fetch enrichment data: service name, client name, tenant_id
      const { data: servicoData } = await supabase
        .from("servicos")
        .select("nome")
        .eq("id", appointment.servico_id)
        .single();

      const { data: profileData } = await supabase
        .from("profiles")
        .select("nome, telefone")
        .eq("id", callerUserId)
        .single();

      const { data: barbeiroData } = await supabase
        .from("barbeiros")
        .select("tenant_id, apelido")
        .eq("id", appointment.barbeiro_id)
        .single();

      const webhookPayload = {
        evento: "agendamento_cancelado",
        descricao: "Agendamento cancelado pelo cliente",
        status: "cancelado",
        agendamento_id: appointmentId,
        data: appointment.data,
        hora: appointment.hora,
        servico: servicoData?.nome || "Serviço",
        valor_total: appointment.preco,
        preco: appointment.preco,
        cliente_id: callerUserId,
        cliente_nome: profileData?.nome || "Cliente",
        cliente_telefone: profileData?.telefone || null,
        barbeiro_id: appointment.barbeiro_id,
        barbeiro_nome: barbeiroData?.apelido || null,
        detalhes: {
          cancelado_por: "cliente",
          credito_gerado: refundedAmount,
          tenant_id: barbeiroData?.tenant_id || null,
        },
      };

      // Call the existing send-webhook-event function internally
      const functionUrl = `${supabaseUrl}/functions/v1/send-webhook-event`;
      fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(webhookPayload),
      }).catch((e) => console.error("Webhook dispatch failed (fire-and-forget):", e));
    } catch (webhookErr) {
      // Never block the cancellation response
      console.error("Webhook enrichment error (non-blocking):", webhookErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refundedAmount,
        appointmentId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("cancel-appointment-client error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
