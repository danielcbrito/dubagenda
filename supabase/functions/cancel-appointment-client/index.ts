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
      .select("id, user_id, status, preco, servico_id, data, hora, barbeiro_id, payment_method, observacoes, is_free, tipo_agendamento")
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

    // 4. Handle refund — ONLY for methods where payment was actually collected
    let refundedAmount = 0;

    const paymentMethod = appointment.payment_method || "";

    const isPaidWithCredit =
      paymentMethod === "credit" ||
      paymentMethod === "wallet" ||
      appointment.observacoes?.toLowerCase().includes("crédito do app") ||
      appointment.observacoes?.toLowerCase().includes("credito do app");

    const isPaidViaGateway =
      paymentMethod === "pix" ||
      paymentMethod === "card" ||
      paymentMethod === "credit_card";

    const isNeverRefundable =
      paymentMethod === "cash" ||
      paymentMethod === "na_hora" ||
      paymentMethod === "resgate" ||
      paymentMethod === "plano" ||
      paymentMethod === "" ||
      appointment.tipo_agendamento === "encaixe_manual";

    const amount = appointment.preco || 0;

    if (isNeverRefundable || appointment.is_free || amount <= 0) {
      // Cash/na_hora: cliente não pagou ainda
      // Resgate: corte grátis por pontos
      // Plano: uso de assinatura, não há pagamento avulso
      // Encaixe manual: walk-in criado pelo barbeiro
      refundedAmount = 0;
    } else if (isPaidWithCredit && amount > 0) {
      // Crédito/wallet: cliente usou saldo que já estava na carteira
      refundedAmount = amount;
    } else if (isPaidViaGateway && amount > 0) {
      // PIX/Cartão: só reembolsa se pagamento CONFIRMADO na tabela pagamentos
      const { data: payment } = await supabase
        .from("pagamentos")
        .select("id, status, valor")
        .eq("agendamento_id", appointmentId)
        .eq("status", "pago")
        .maybeSingle();

      if (payment) {
        refundedAmount = payment.valor || amount;
      } else {
        // Fallback: se não há registro em pagamentos, usar o preço do agendamento
        refundedAmount = amount;
      }
    }

    // 4a. PIX: tentar estorno direto na conta bancária via Woovi
    let bankRefunded = false;
    if (paymentMethod === "pix" && refundedAmount > 0) {
      try {
        const { data: charge } = await supabase
          .from("woovi_charges")
          .select("correlation_id, raw_response, value_centavos")
          .eq("agendamento_id", appointmentId)
          .eq("status", "PAID")
          .maybeSingle();

        const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI");
        if (charge && wooviAppId) {
          const raw = charge.raw_response as any;
          const endToEndId =
            raw?.pix?.endToEndId ?? raw?.endToEndId ?? raw?.charge?.endToEndId;
          const subPixKey =
            raw?.charge?.subaccount?.pixKey ??
            raw?.subaccount?.pixKey ??
            raw?.pix?.charge?.subaccount?.pixKey;
          const valueCents = charge.value_centavos ?? Math.round(refundedAmount * 100);

          const refundBody: Record<string, unknown> = {
            correlationID: `refund-${appointmentId}-${Date.now()}`,
            transactionEndToEndId: endToEndId,
            value: valueCents,
          };
          if (subPixKey) refundBody.pixKey = subPixKey;

          const refundResp = await fetch("https://api.woovi.com/api/v1/refund", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: wooviAppId,
            },
            body: JSON.stringify(refundBody),
          });

          const refundData = await refundResp.json().catch(() => ({}));
          if (refundResp.ok) {
            bankRefunded = true;
            console.log(`[cancel-appointment-client] PIX estornado via Woovi para ${appointmentId}`);
            await supabase
              .from("pagamentos")
              .update({ status: "refunded" })
              .eq("agendamento_id", appointmentId);
          } else {
            console.error("[cancel-appointment-client] Falha estorno Woovi:", refundData);
          }
        }
      } catch (err) {
        console.error("[cancel-appointment-client] Erro no estorno Woovi:", err);
      }
    }

    // Credit wallet atomically via RPC (prevents race conditions) — fallback quando estorno bancário não foi feito
    if (refundedAmount > 0 && !bankRefunded) {
      const description = isPaidWithCredit
        ? `Estorno de cancelamento - R$ ${refundedAmount.toFixed(2)}`
        : isPaidViaGateway
          ? `Estorno de cancelamento (${paymentMethod === "pix" ? "PIX" : "Cartão"}) - R$ ${refundedAmount.toFixed(2)}`
          : `Estorno de cancelamento - R$ ${refundedAmount.toFixed(2)}`;

      const { error: walletError } = await supabase.rpc("add_wallet_credits", {
        p_user_id: callerUserId,
        p_amount: refundedAmount,
        p_description: description,
      });

      if (walletError) {
        console.error("Wallet RPC error:", walletError);
        // Don't fail — appointment is already cancelled
      }
    }

    // 5. Create notification
    await supabase.from("notificacoes").insert({
      user_id: callerUserId,
      tipo: "cancelamento",
      titulo: "Agendamento cancelado",
      mensagem: bankRefunded
        ? `Seu agendamento foi cancelado. R$ ${refundedAmount.toFixed(2)} foi estornado para a sua conta bancária (PIX).`
        : refundedAmount > 0
          ? `Seu agendamento foi cancelado. R$ ${refundedAmount.toFixed(2)} foi adicionado à sua carteira.`
          : "Seu agendamento foi cancelado com sucesso.",
      agendamento_id: appointmentId,
    });

    // 6. Notificações automáticas via triggers de banco de dados
    // O trigger trg_notify_appointment_cancelled_whatsapp enviará o WhatsApp automaticamente
    // ao detectar a mudança de status para 'cancelled_by_user'.
    // Removemos a chamada manual para evitar duplicidade de mensagens.

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
