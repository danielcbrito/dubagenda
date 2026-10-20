import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTime(value: string | null | undefined): string {
  if (!value) return "";
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDatePtBR(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function buildRescheduleMessage(params: {
  clienteNome?: string | null;
  servico?: string | null;
  data: string;
  hora: string;
}) {
  const nome = params.clienteNome?.split(" ")[0] || "Cliente";
  const servico = params.servico || "serviço";
  return `*Agendamento Remarcado!*\nOlá ${nome}! Seu ${servico} foi remarcado com sucesso para ${formatDatePtBR(params.data)} às ${normalizeTime(params.hora)}.\nNos vemos em breve! 💈`;
}

async function resolveBusinessHours(supabase: any, date: string, barberId: string) {
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  let configData: any = null;

  let tenantId: string | null = null;
  if (barberId) {
    const { data: barberScope } = await supabase
      .from("barbeiros")
      .select("tenant_id")
      .eq("id", barberId)
      .maybeSingle();
    tenantId = barberScope?.tenant_id ?? null;
  }

  const { data: barberException } = await supabase
    .from("horarios_excepcionais_barbeiro")
    .select("*")
    .eq("barbeiro_id", barberId)
    .eq("data", date)
    .maybeSingle();
  configData = barberException;

  if (!configData) {
    let globalExceptionQuery = supabase
      .from("horarios_excepcionais")
      .select("*")
      .eq("data", date);
    if (tenantId) globalExceptionQuery = globalExceptionQuery.eq("tenant_id", tenantId);
    const { data: globalException } = await globalExceptionQuery.maybeSingle();
    configData = globalException;
  }

  if (!configData) {
    const { data: barberConfig } = await supabase
      .from("configuracoes_horario_barbeiro")
      .select("*")
      .eq("barbeiro_id", barberId)
      .eq("dia_semana", dayOfWeek)
      .maybeSingle();
    if (barberConfig && barberConfig.aberto !== null) configData = barberConfig;
  }

  if (!configData && tenantId) {
    const { data: unitConfig } = await supabase
      .from("configuracoes_horario_unidade")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("dia_semana", dayOfWeek)
      .order("unidade_id", { nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (unitConfig) configData = unitConfig;
  }

  if (!configData) {
    const { data: globalConfig } = await supabase
      .from("configuracoes_horario")
      .select("*")
      .eq("dia_semana", dayOfWeek)
      .maybeSingle();
    configData = globalConfig;
  }

  return configData
    ? {
        aberto: configData.aberto ?? true,
        hora_abertura: configData.hora_abertura || "09:00",
        hora_fechamento: configData.hora_fechamento || "21:00",
        hora_almoco_inicio: configData.hora_almoco_inicio,
        hora_almoco_fim: configData.hora_almoco_fim,
        delay_entre_servicos: configData.delay_entre_servicos || 10,
      }
    : {
        aberto: dayOfWeek !== 0,
        hora_abertura: "09:00",
        hora_fechamento: "21:00",
        hora_almoco_inicio: "13:00",
        hora_almoco_fim: "14:00",
        delay_entre_servicos: 10,
      };
}

async function validateRescheduleAvailability(params: {
  supabase: any;
  appointmentId: string;
  data: string;
  hora: string;
  duracao: number;
  barberId: string;
}) {
  const { supabase, appointmentId, data, hora, duracao, barberId } = params;
  const config = await resolveBusinessHours(supabase, data, barberId);

  if (!config.aberto) return { valid: false, message: "A barbearia não funciona neste dia." };

  const start = timeToMinutes(hora);
  const end = start + duracao;
  const open = timeToMinutes(config.hora_abertura);
  const close = timeToMinutes(config.hora_fechamento);
  const lunchStart = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
  const lunchEnd = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;

  if (start < open || end > close) {
    return { valid: false, message: `Horário fora do expediente. Funcionamento: ${config.hora_abertura} às ${config.hora_fechamento}.` };
  }

  if (lunchStart !== null && lunchEnd !== null && start < lunchEnd && end > lunchStart) {
    return { valid: false, message: `Horário indisponível. A barbearia está fechada para almoço entre ${config.hora_almoco_inicio} e ${config.hora_almoco_fim}.` };
  }

  const { data: appointments, error: appointmentsError } = await supabase
    .from("agendamentos")
    .select("id, hora, duracao")
    .eq("data", data)
    .eq("barbeiro_id", barberId)
    .in("status", ["pending", "confirmed", "completed"])
    .neq("id", appointmentId);

  if (appointmentsError) {
    console.error("[cancel-appointment-client] erro disponibilidade agendamentos:", appointmentsError);
    return { valid: false, message: "Erro ao verificar disponibilidade." };
  }

  const delay = 0;
  for (const appointment of appointments || []) {
    const appointmentStart = timeToMinutes(appointment.hora);
    const appointmentEnd = appointmentStart + appointment.duracao + delay;
    if (start < appointmentEnd && end > appointmentStart) {
      return { valid: false, message: "Horário indisponível. Já existe um agendamento nesse período." };
    }
  }

  const { data: pendingBookings } = await supabase
    .from("pending_bookings")
    .select("id, hora, duracao")
    .eq("data", data)
    .eq("barbeiro_id", barberId)
    .gt("expires_at", new Date().toISOString());

  for (const pending of pendingBookings || []) {
    const pendingStart = timeToMinutes(pending.hora);
    const pendingEnd = pendingStart + pending.duracao + delay;
    if (start < pendingEnd && end > pendingStart) {
      return { valid: false, message: "Horário temporariamente reservado. Tente outro horário ou aguarde alguns minutos." };
    }
  }

  return { valid: true, message: "Horário disponível" };
}

async function handleReschedule(params: {
  supabase: any;
  supabaseUrl: string;
  serviceKey: string;
  callerUserId: string;
  callerEmail?: string | null;
  body: any;
}) {
  const { supabase, supabaseUrl, serviceKey, callerUserId, callerEmail, body } = params;
  const appointmentId = String(body.appointmentId || "");
  const data = String(body.data || "");
  const hora = normalizeTime(String(body.hora || ""));
  const duracao = body.duracao ? Number(body.duracao) : undefined;
  const dryRun = body.dryRun === true;

  if (!appointmentId || !data || !hora || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return jsonResponse({ error: "Dados inválidos para remarcação" }, 400);
  }

  const { data: appointment, error: fetchError } = await supabase
    .from("agendamentos")
    .select(`
      id, user_id, barbeiro_id, servico_id, data, hora, duracao, status, preco,
      tipo_agendamento, payment_method,
      servicos:servico_id (nome),
      barbeiros:barbeiro_id (apelido, tenant_id)
    `)
    .eq("id", appointmentId)
    .single();

  if (fetchError || !appointment) return jsonResponse({ error: "Agendamento não encontrado" }, 404);
  if (appointment.user_id !== callerUserId) return jsonResponse({ error: "Sem permissão para remarcar este agendamento" }, 403);
  if (!["pending", "confirmed"].includes(appointment.status)) {
    return jsonResponse({ error: `Agendamento com status '${appointment.status}' não pode ser remarcado` }, 400);
  }
  if (!appointment.barbeiro_id) return jsonResponse({ error: "Agendamento sem profissional vinculado não pode ser remarcado" }, 400);

  const isPlanAppointment = (appointment as any).tipo_agendamento === 'plano' || (appointment as any).payment_method === 'plano';
  const barberTenantId = (appointment as any).barbeiros?.tenant_id;
  if (isPlanAppointment && barberTenantId === '5e825363-70ff-4abe-9143-9e87758437e7') {
    const targetDow = new Date(`${data}T12:00:00`).getDay();
    if (![2, 3, 4].includes(targetDow)) {
      return jsonResponse({
        error: "Agendamentos com plano nesta barbearia são permitidos exclusivamente de terça a quinta-feira.",
        code: "VIP_PLAN_DAY_RESTRICTED"
      }, 400);
    }
  }

  const durationToUse = duracao || appointment.duracao;
  const availability = await validateRescheduleAvailability({
    supabase,
    appointmentId,
    data,
    hora,
    duracao: durationToUse,
    barberId: appointment.barbeiro_id,
  });

  if (!availability.valid) return jsonResponse({ error: availability.message, code: "TIME_SLOT_UNAVAILABLE" }, 409);

  if (dryRun) {
    return jsonResponse({ success: true, valid: true, message: availability.message });
  }

  const previousDate = appointment.data;
  const previousTime = normalizeTime(appointment.hora);

  const { data: updatedAppointment, error: updateError } = await supabase
    .from("agendamentos")
    .update({
      data,
      hora,
      duracao: durationToUse,
      status: "confirmed",
      barbeiro_confirmou: true,
      cliente_confirmou: true,
      remarcacao_solicitada: false,
      motivo_remarcacao: null,
      visivel_para_usuario: true,
    })
    .eq("id", appointmentId)
    .select("id, data, hora, duracao, status, updated_at")
    .single();

  if (updateError) {
    console.error("[cancel-appointment-client] erro ao remarcar:", updateError);
    return jsonResponse({ error: "Erro ao remarcar agendamento" }, 500);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, telefone")
    .eq("id", callerUserId)
    .maybeSingle();

  const serviceName = Array.isArray(appointment.servicos) ? appointment.servicos[0]?.nome : appointment.servicos?.nome;
  const barber = Array.isArray(appointment.barbeiros) ? appointment.barbeiros[0] : appointment.barbeiros;
  const message = buildRescheduleMessage({ clienteNome: profile?.nome || callerEmail, servico: serviceName, data, hora });

  let notification: Record<string, unknown> | null = null;
  try {
    const webhookResponse = await fetch(`${supabaseUrl}/functions/v1/send-webhook-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        evento: "remarcacao_concluida",
        descricao: "Cliente concluiu a remarcação do agendamento",
        status: "remarcado",
        agendamento_id: appointmentId,
        data,
        hora,
        duracao_minutos: durationToUse,
        servico_id: appointment.servico_id,
        servico: serviceName || "Serviço",
        valor_total: appointment.preco,
        preco: appointment.preco,
        cliente_id: callerUserId,
        cliente_nome: profile?.nome || callerEmail || "Cliente",
        cliente_telefone: profile?.telefone || null,
        cliente_email: callerEmail || null,
        barbeiro_id: appointment.barbeiro_id,
        barbeiro_nome: barber?.apelido || null,
        mensagem: message,
        detalhes: {
          tenant_id: barber?.tenant_id || null,
          data_anterior: previousDate,
          hora_anterior: previousTime,
        },
      }),
    });
    notification = await webhookResponse.json().catch(() => null);
  } catch (notificationError) {
    console.warn("[cancel-appointment-client] falha webhook remarcação:", notificationError);
  }

  return jsonResponse({ success: true, appointment: updatedAppointment, notification });
}

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
    const body = await req.json();
    const { appointmentId } = body;
    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: "appointmentId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Service-role client for privileged operations ──
    const supabase = createClient(supabaseUrl, serviceKey);

    if (body.action === "reschedule") {
      return await handleReschedule({
        supabase,
        supabaseUrl,
        serviceKey,
        callerUserId,
        callerEmail: claimsData.user.email,
        body,
      });
    }

    // 1. Fetch appointment and verify ownership
    const { data: appointment, error: fetchError } = await supabase
      .from("agendamentos")
      .select("id, user_id, status, preco, servico_id, data, hora, barbeiro_id, payment_method, observacoes, is_free, tipo_agendamento, usado_redemption_id")
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

    // 3. Determinar método de pagamento e valor
    const paymentMethod = appointment.payment_method || "";
    const amount = appointment.preco || 0;

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

    // 4. Cancela o agendamento
    const { error: updateError } = await supabase
      .from("agendamentos")
      .update({
        status: "cancelled_by_user",
        visivel_para_usuario: false,
      })
      .eq("id", appointmentId)
      .in('status', ['pending', 'confirmed'])
      .select('id')
      .single();

    if (updateError) throw updateError;

    // 4.1 Determinar taxa de cancelamento baseada na regra do sistema (grátis > 2h, cobra < 2h)
    let feeApplied = 0;
    let debtRecorded = false;
    const aptDateTime = new Date(`${appointment.data}T${appointment.hora}`).getTime();
    const isFree = (aptDateTime - Date.now()) > 2 * 3600000;

    if (!isFree && appointment.barbeiro_id) {
      try {
        const { data: barber } = await supabase
          .from('barbeiros')
          .select('tenant_id, apelido')
          .eq('id', appointment.barbeiro_id)
          .maybeSingle();

        if (barber?.tenant_id) {
          const { data: configRow } = await supabase
            .from('informacoes_empresa')
            .select('valor')
            .eq('tenant_id', barber.tenant_id)
            .eq('chave', `taxa_cancelamento_${appointment.barbeiro_id}`)
            .eq('ativo', true)
            .maybeSingle();

          if (configRow?.valor) {
            const config = typeof configRow.valor === 'string' ? JSON.parse(configRow.valor) : configRow.valor;
            if (config.habilitado) {
              let basePrice = Number(appointment.preco) || 0;
              if (basePrice <= 0 && appointment.servico_id) {
                const { data: svc } = await supabase.from('servicos').select('preco').eq('id', appointment.servico_id).maybeSingle();
                basePrice = Number(svc?.preco) || 0;
              }

              if (basePrice > 0) {
                const { calculateCancellationFee } = await import('../_shared/cancellation-fee.ts');
                feeApplied = calculateCancellationFee(config, basePrice, aptDateTime, Date.now(), false);
              }
            }
          }
        }
      } catch (errFee) {
        console.warn('[cancel-appointment-client] Erro ao calcular taxa de cancelamento:', errFee);
      }
    }

    // Se o agendamento usou de verdade um Corte Grátis, cancelar deve liberar
    // o mesmo benefício para o cliente remarcar.
    let redemptionId = appointment.usado_redemption_id as string | null;

    if (!redemptionId) {
      const { data: redemption } = await supabase
        .from("resgates")
        .select("id")
        .eq("appointment_id", appointmentId)
        .eq("user_id", callerUserId)
        .eq("status", "used")
        .maybeSingle();

      redemptionId = redemption?.id ?? null;
    }

    if (redemptionId) {
      await supabase
        .from("resgates")
        .update({
          status: "available",
          used_at: null,
          appointment_id: null,
          expired_at: null,
        })
        .eq("id", redemptionId)
        .eq("user_id", callerUserId)
        .eq("status", "used");

      await supabase.from("loyalty_audit_logs").insert({
        user_id: callerUserId,
        action: "redemption_restored_after_free_cancel",
        reason: "Agendamento com corte grátis cancelado pelo cliente; benefício liberado para remarcação",
        appointment_id: appointmentId,
        metadata: { redemption_id: redemptionId },
      });
    }

    // 5. Processamento financeiro:
    //    - Pagamento via Pix / Gateway / Crédito: desconta a taxa de cancelamento do estorno.
    //    - Pagamento na Barbearia / Sem pré-pagamento: registra a taxa como dívida do cliente na carteira/financeiro.
    let refundedAmount = 0;
    let creditedToWallet = false;

    const isPrepaid = !isNeverRefundable && !appointment.is_free && amount > 0 &&
      (isPaidWithCredit || isPaidViaGateway);

    if (isPrepaid) {
      // Reembolso com desconto da taxa de cancelamento
      refundedAmount = Math.max(0, amount - feeApplied);

      let wooviMeta: Record<string, unknown> | null = null;
      let descSuffix = "";

      if (paymentMethod === "pix") {
        const { data: charge } = await supabase
          .from("woovi_charges")
          .select("correlation_id, raw_response, value_centavos")
          .eq("agendamento_id", appointmentId)
          .eq("status", "PAID")
          .maybeSingle();

        if (charge) {
          const raw = charge.raw_response as any;
          const endToEndId =
            raw?.pix?.endToEndId ?? raw?.endToEndId ?? raw?.charge?.endToEndId;
          const subPixKey =
            raw?.charge?.subaccount?.pixKey ??
            raw?.charge?.subaccount ??
            raw?.subaccount?.pixKey ??
            raw?.subaccount ??
            raw?.pix?.charge?.subaccount?.pixKey;
          wooviMeta = {
            source: "pix_cancellation",
            woovi_correlation_id: charge.correlation_id,
            woovi_endToEndId: endToEndId,
            woovi_subPixKey: subPixKey,
            woovi_value_centavos: charge.value_centavos ?? Math.round(amount * 100),
            agendamento_id: appointmentId,
            taxa_descontada: feeApplied,
            valor_original: amount,
          };
          descSuffix = " (PIX)";
        }

        await supabase
          .from("pagamentos")
          .update({ status: "refunded_to_wallet" })
          .eq("agendamento_id", appointmentId);
      } else if (paymentMethod === "card" || paymentMethod === "credit_card") {
        descSuffix = " (Cartão)";
      }

      if (refundedAmount > 0) {
        // Credita o valor líquido no saldo da carteira
        const { data: currentBalance } = await supabase
          .rpc("get_or_create_wallet_balance", { p_user_id: callerUserId });

        await supabase
          .from("wallet_balances")
          .update({ balance: (currentBalance || 0) + refundedAmount })
          .eq("user_id", callerUserId);

        const txDesc = feeApplied > 0
          ? `Estorno de cancelamento${descSuffix} (taxa de R$ ${feeApplied.toFixed(2)} descontada) - R$ ${refundedAmount.toFixed(2)}`
          : `Estorno integral de cancelamento${descSuffix} - R$ ${refundedAmount.toFixed(2)}`;

        await supabase.from("wallet_transactions").insert({
          user_id: callerUserId,
          type: "refund",
          amount: refundedAmount,
          status: "completed",
          description: txDesc,
          metadata: wooviMeta,
        });

        creditedToWallet = true;
      }

      // Se a taxa for maior que o valor pago (caso raro), registra a diferença como dívida
      if (feeApplied > amount) {
        const remainingDebt = feeApplied - amount;
        await recordClientDebt(supabase, callerUserId, appointment, remainingDebt);
        debtRecorded = true;
      }
    } else if (feeApplied > 0) {
      // Pagamento na barbearia (presencial) ou sem pré-pagamento: taxa vira dívida pendente acumulada
      await recordClientDebt(supabase, callerUserId, appointment, feeApplied);
      debtRecorded = true;
    }

    // 6. Criar notificação detalhada para o cliente
    let notificationTitle = "Agendamento cancelado";
    let notificationMsg = "Seu agendamento foi cancelado com sucesso.";

    if (feeApplied > 0 && creditedToWallet) {
      notificationTitle = "Agendamento cancelado com taxa";
      notificationMsg = `Cancelamento com menos de 2h de antecedência. Taxa de R$ ${feeApplied.toFixed(2).replace('.', ',')} descontada. Reembolso líquido de R$ ${refundedAmount.toFixed(2).replace('.', ',')} creditado na sua carteira.`;
    } else if (feeApplied > 0 && debtRecorded) {
      notificationTitle = "Taxa de cancelamento registrada";
      notificationMsg = `Cancelamento com menos de 2h de antecedência. Taxa de cancelamento: R$ ${feeApplied.toFixed(2).replace('.', ',')}. Este valor foi registrado e será somado no seu próximo agendamento.`;
    } else if (creditedToWallet) {
      notificationTitle = "Cancelamento gratuito realizado";
      notificationMsg = `Seu agendamento foi cancelado gratuitamente. R$ ${refundedAmount.toFixed(2).replace('.', ',')} foi creditado integralmente na sua carteira.`;
    } else if (isFree) {
      notificationTitle = "Cancelamento gratuito confirmado";
      notificationMsg = "Seu agendamento foi cancelado gratuitamente (mais de 2 horas antes do horário).";
    }

    await supabase.from("notificacoes").insert({
      user_id: callerUserId,
      tipo: feeApplied > 0 ? "taxa_cancelamento" : "cancelamento",
      titulo: notificationTitle,
      mensagem: notificationMsg,
      agendamento_id: appointmentId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        refundedAmount,
        feeApplied,
        debtRecorded,
        freeCancellation: isFree || feeApplied === 0,
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

/**
 * Função auxiliar para registrar dívida pendente acumulada na tabela informacoes_empresa
 */
async function recordClientDebt(supabase: any, userId: string, appointment: any, feeAmount: number) {
  try {
    const { data: barber } = await supabase
      .from('barbeiros')
      .select('tenant_id, apelido')
      .eq('id', appointment.barbeiro_id)
      .maybeSingle();

    if (!barber?.tenant_id) return;

    const { data: existingRow } = await supabase
      .from('informacoes_empresa')
      .select('id, valor')
      .eq('tenant_id', barber.tenant_id)
      .eq('categoria', 'debitos_cliente')
      .eq('chave', `debito_cancelamento_${userId}`)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('nome, telefone')
      .eq('id', userId)
      .maybeSingle();

    const newItem = {
      id: crypto.randomUUID(),
      agendamento_id: appointment.id,
      barbeiro_id: appointment.barbeiro_id,
      barbeiro_nome: barber.apelido || 'Barbeiro',
      motivo: 'cancelamento_tardio',
      valor_taxa: feeAmount,
      valor_servico_original: appointment.preco || 0,
      status: 'pendente',
      created_at: new Date().toISOString(),
      tenant_id: barber.tenant_id,
    };

    if (existingRow && existingRow.valor) {
      let existingVal = typeof existingRow.valor === 'string' ? JSON.parse(existingRow.valor) : existingRow.valor;
      let itens = Array.isArray(existingVal.itens) ? existingVal.itens : [existingVal];
      itens.push(newItem);

      const totalPendente = itens
        .filter((it: any) => it.status === 'pendente')
        .reduce((sum: number, it: any) => sum + (Number(it.valor_taxa) || 0), 0);

      existingVal = {
        ...existingVal,
        total_pendente: totalPendente,
        valor_taxa: totalPendente,
        status: totalPendente > 0 ? 'pendente' : 'pago',
        itens,
        updated_at: new Date().toISOString(),
      };

      await supabase.from('informacoes_empresa').update({
        valor: JSON.stringify(existingVal),
        ativo: true,
        atualizado_em: new Date().toISOString(),
      }).eq('id', existingRow.id);
    } else {
      const debtData = {
        id: crypto.randomUUID(),
        cliente_id: userId,
        cliente_nome: profile?.nome || '',
        cliente_telefone: profile?.telefone || '',
        total_pendente: feeAmount,
        valor_taxa: feeAmount,
        status: 'pendente',
        itens: [newItem],
        tenant_id: barber.tenant_id,
        created_at: new Date().toISOString(),
      };

      await supabase.from('informacoes_empresa').insert({
        tenant_id: barber.tenant_id,
        chave: `debito_cancelamento_${userId}`,
        categoria: 'debitos_cliente',
        valor: JSON.stringify(debtData),
        ativo: true,
      });
    }
  } catch (err) {
    console.error('[cancel-appointment-client] Erro ao gravar dívida acumulada:', err);
  }
}

