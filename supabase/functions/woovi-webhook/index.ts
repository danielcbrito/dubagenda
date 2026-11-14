// Edge Function: woovi-webhook
// Recebe notificações da Woovi (Pix pago) e atualiza o status em woovi_charges,
// confirmando o pending_booking correspondente como agendamento real.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { confirmDebtPayment } from '../_shared/debt-payment.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const payload = await req.json().catch(() => ({}));
    console.log("woovi-webhook payload:", JSON.stringify(payload));

    // Woovi envia o evento com payload contendo `event` e `charge`/`pix`
    const charge = payload.charge ?? payload.pix?.charge ?? payload;
    const correlationID: string | undefined = charge?.correlationID;
    const status: string | undefined = charge?.status;

    if (!correlationID) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPaid =
      payload.event === "OPENPIX:CHARGE_COMPLETED" ||
      payload.event === "OPENPIX:TRANSACTION_RECEIVED" ||
      status === "COMPLETED" ||
      status === "ACTIVE_PAID";

    if (!isPaid) {
      return new Response(JSON.stringify({ ok: true, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 0. Tratamento prioritário de quitação de taxa de cancelamento (divida-<id>)
    if (correlationID.startsWith('divida-')) {
      const dividaId = correlationID.slice(7);
      console.log(`[woovi-webhook] Processando pagamento de taxa de cancelamento da dívida: ${dividaId}`);

      const { data: quitResult, error: quitError } = await admin.rpc('quitar_divida', {
        p_divida_id: dividaId,
        p_pix_id: correlationID,
      });

      if (quitError) {
        console.error('[woovi-webhook] Erro ao executar quitar_divida:', quitError);
        // Fallback: atualizar status direto na tabela dividas
        await admin
          .from('dividas')
          .update({ status: 'pago', pago_em: new Date().toISOString(), pix_id: correlationID })
          .eq('id', dividaId);
      }

      await admin
        .from('woovi_charges')
        .update({ status: 'PAID' })
        .eq('correlation_id', correlationID);

      return new Response(
        JSON.stringify({ ok: true, paid: true, dividaId, result: quitResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Buscar cobrança local
    const { data: localCharge } = await admin
      .from("woovi_charges")
      .select("*")
      .eq("correlation_id", correlationID)
      .maybeSingle();

    if (!localCharge) {
      console.log(
        `[woovi-webhook] charge ${correlationID} não encontrada localmente (provavelmente tratada pelo Painel Admin), ignorando.`,
      );
      return new Response(JSON.stringify({ ok: true, missing: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (localCharge.metadata?.purpose === 'cancellation_debt') {
      const appId = Deno.env.get('ID_DO_APLICATIVO_WOOVI');
      if (!appId) throw new Error('PIX indisponível');
      const paid = await confirmDebtPayment(admin, localCharge, appId);
      return new Response(JSON.stringify({ ok: true, paid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Idempotência: se já processada, ignora silenciosamente
    if (localCharge.status === "PAID" || localCharge.agendamento_id) {
      console.log(
        `[woovi-webhook] charge ${correlationID} já processada (status=${localCharge.status}, agendamento_id=${localCharge.agendamento_id}), ignorando.`,
      );
      return new Response(
        JSON.stringify({ ok: true, duplicate: true, agendamentoId: localCharge.agendamento_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Resolver alvo do correlation: book-<pendingBookingId> ou sub-<assinaturaId>
    const pbId = correlationID.startsWith("book-") ? correlationID.slice(5) : null;
    const subId = correlationID.startsWith("sub-") ? correlationID.slice(4) : null;

    let agendamentoId: string | null = localCharge.agendamento_id ?? null;

    if (pbId && !agendamentoId) {
      const { data: pb } = await admin
        .from("pending_bookings")
        .select("*")
        .eq("id", pbId)
        .maybeSingle();

      if (pb) {
        const { data: appt, error: apptErr } = await admin
          .from("agendamentos")
          .insert({
            user_id: pb.user_id,
            barbeiro_id: pb.barbeiro_id,
            servico_id: pb.servico_id,
            data: pb.data,
            hora: pb.hora,
            duracao: pb.duracao,
            preco: pb.preco,
            observacoes: pb.observacoes,
            payment_method: "pix",
            status: "confirmed",
          })
          .select("id")
          .single();

        if (!apptErr && appt) {
          agendamentoId = appt.id;
          await admin.from("pending_bookings").delete().eq("id", pb.id);

          // Quitar dívidas pendentes de cancelamento/falta do cliente vinculadas a este pagamento
          try {
            await admin.rpc("settle_client_debts", {
              p_client_id: pb.user_id,
              p_correlation: correlationID,
            });
          } catch (settleErr) {
            console.warn("[woovi-webhook] Erro ao quitar débitos do cliente:", settleErr);
          }
        } else {
          // Detecta conflito de slot (unique constraint) → faz refund automático para a carteira do cliente
          const isConflict =
            apptErr?.code === "23505" ||
            /duplicate key|unique constraint/i.test(apptErr?.message ?? "");

          if (isConflict) {
            console.warn(
              `[woovi-webhook] Slot conflict para pending_booking ${pb.id}. Creditando carteira do usuário ${pb.user_id}.`,
            );

            const valor = Number(pb.preco) || (localCharge.value_centavos ? localCharge.value_centavos / 100 : 0);

            // Credita carteira (cria saldo se não existir)
            const { data: currentBalance } = await admin.rpc(
              "get_or_create_wallet_balance",
              { p_user_id: pb.user_id },
            );
            const newBalance = (Number(currentBalance) || 0) + valor;
            await admin
              .from("wallet_balances")
              .update({ balance: newBalance })
              .eq("user_id", pb.user_id);

            const endToEndId =
              payload?.pix?.endToEndId ??
              payload?.endToEndId ??
              payload?.charge?.endToEndId ??
              localCharge?.raw_response?.pix?.endToEndId ??
              null;

            const feeCents = Number(
              payload?.pix?.charge?.fee ??
                payload?.charge?.fee ??
                localCharge?.raw_response?.pix?.charge?.fee ??
                localCharge?.raw_response?.charge?.fee ??
                0,
            );

            await admin.from("wallet_transactions").insert({
              user_id: pb.user_id,
              type: "refund",
              amount: valor,
              status: "completed",
              description: `Estorno automático - horário ${pb.data} ${pb.hora} indisponível no momento da confirmação`,
              metadata: {
                source: "slot_conflict_auto_refund",
                woovi_correlation_id: correlationID,
                woovi_endToEndId: endToEndId,
                woovi_value_centavos: Math.round(valor * 100),
                woovi_fee_centavos: feeCents,
                pending_booking_id: pb.id,
              },
            });

            // Notifica o cliente
            await admin.from("notificacoes").insert({
              user_id: pb.user_id,
              tipo: "cancelamento",
              titulo: "Reembolso automático",
              mensagem: `O horário ${pb.hora.slice(0, 5)} foi reservado antes da confirmação do seu pagamento. Creditamos R$ ${valor.toFixed(2).replace(".", ",")} na sua carteira.`,
              lida: false,
            }).then(() => {}, () => {});

            await admin.from("pending_bookings").delete().eq("id", pb.id);
          } else {
            console.error("Erro ao criar agendamento:", apptErr);
          }
        }
      }
    }

    if (subId) {
      const { data: sub } = await admin
        .from("assinaturas")
        .select("id, user_id, status, total_renovacoes, plano:planos(preco_mensal)")
        .eq("id", subId)
        .maybeSingle();
      if (sub && sub.status !== "active") {
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        const updates: Record<string, unknown> = {
          status: "active",
          next_billing_date: nextBilling.toISOString().split("T")[0],
          pix_qr_code: null,
          pix_payload: null,
          pix_expires_at: null,
          asaas_payment_id: null,
          updated_at: new Date().toISOString(),
        };
        if (sub.status === "pending_renewal") {
          updates.ciclo_inicio = new Date().toISOString().split("T")[0];
          updates.ciclo_fim = nextBilling.toISOString().split("T")[0];
          updates.usos_ciclo_atual = 0;
          updates.total_renovacoes = (sub.total_renovacoes || 0) + 1;
          updates.renovada_antecipadamente = true;
          updates.cash_payment_confirmed = null;
        }
        await admin.from("assinaturas").update(updates).eq("id", subId);
        // Renovação: encerra a assinatura anterior do cliente (mantém histórico, não apaga)
        await admin
          .from("assinaturas")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("user_id", sub.user_id)
          .eq("status", "active")
          .neq("id", subId);
        await admin.from("pagamentos").insert({
          user_id: sub.user_id,
          assinatura_id: subId,
          metodo: "pix",
          valor: (sub as any).plano?.preco_mensal ?? (localCharge.value_centavos ? localCharge.value_centavos / 100 : null),
          gateway_payment_id: correlationID,
          status: "paid",
          data_pagamento: new Date().toISOString(),
        });
      }
    }


    // 3. Atualizar cobrança
    await admin
      .from("woovi_charges")
      .update({
        status: "PAID",
        paid_at: new Date().toISOString(),
        agendamento_id: agendamentoId,
        raw_response: payload,
      })
      .eq("correlation_id", correlationID);

    return new Response(JSON.stringify({ ok: true, agendamentoId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("woovi-webhook error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
