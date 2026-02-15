import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

/**
 * Converte HH:MM para minutos totais
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Verifica disponibilidade do horário
 */
async function checkTimeSlotAvailability(
  supabase: any,
  data: string,
  hora: string,
  duracao: number,
  excludeAppointmentId?: string,
  barbeiro_id?: string | null,
  currentUserId?: string
): Promise<{ available: boolean; message: string }> {
  const startTimeInMinutes = timeToMinutes(hora);
  const endTimeInMinutes = startTimeInMinutes + duracao;

  const appointmentDate = new Date(data + "T12:00:00");
  const dayOfWeek = appointmentDate.getDay();

  let config: any = null;

  if (barbeiro_id) {
    const { data: barbeiroConfig } = await supabase
      .from("configuracoes_horario_barbeiro")
      .select("*")
      .eq("barbeiro_id", barbeiro_id)
      .eq("dia_semana", dayOfWeek)
      .maybeSingle();
    if (barbeiroConfig) config = barbeiroConfig;
  }

  if (!config) {
    const { data: globalConfig } = await supabase
      .from("configuracoes_horario")
      .select("*")
      .eq("dia_semana", dayOfWeek)
      .maybeSingle();
    config = globalConfig || {
      aberto: dayOfWeek !== 0,
      hora_abertura: "09:00",
      hora_fechamento: "21:00",
      hora_almoco_inicio: "13:00",
      hora_almoco_fim: "14:00",
      delay_entre_servicos: 10,
    };
  }

  if (!config.aberto) {
    return { available: false, message: "A barbearia não funciona neste dia." };
  }

  const OPEN = timeToMinutes(config.hora_abertura);
  const CLOSE = timeToMinutes(config.hora_fechamento);
  if (startTimeInMinutes < OPEN || endTimeInMinutes > CLOSE) {
    return { available: false, message: "Horário fora do expediente." };
  }

  const LUNCH_S = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
  const LUNCH_E = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;
  if (LUNCH_S !== null && LUNCH_E !== null) {
    if (
      (startTimeInMinutes >= LUNCH_S && startTimeInMinutes < LUNCH_E) ||
      (endTimeInMinutes > LUNCH_S && endTimeInMinutes <= LUNCH_E) ||
      (startTimeInMinutes < LUNCH_S && endTimeInMinutes > LUNCH_E)
    ) {
      return { available: false, message: "Horário de almoço." };
    }
  }

  const DELAY = config.delay_entre_servicos || 10;

  let query = supabase
    .from("agendamentos")
    .select("id, hora, duracao, status")
    .eq("data", data)
    .in("status", ["pending", "confirmed", "completed"]);
  if (barbeiro_id) query = query.eq("barbeiro_id", barbeiro_id);
  if (excludeAppointmentId) query = query.neq("id", excludeAppointmentId);

  const { data: existing } = await query;
  for (const apt of existing || []) {
    const aptStart = timeToMinutes(apt.hora);
    const aptEndWithDelay = aptStart + apt.duracao + DELAY;
    if (startTimeInMinutes < aptEndWithDelay && endTimeInMinutes > aptStart) {
      return { available: false, message: "Horário indisponível." };
    }
  }

  let pendingQuery = supabase
    .from("pending_bookings")
    .select("id, hora, duracao")
    .eq("data", data)
    .gt("expires_at", new Date().toISOString());
  if (barbeiro_id) pendingQuery = pendingQuery.eq("barbeiro_id", barbeiro_id);
  if (currentUserId) pendingQuery = pendingQuery.neq("user_id", currentUserId);

  const { data: pending } = await pendingQuery;

  for (const pb of pending || []) {
    const pbStart = timeToMinutes(pb.hora);
    const pbEndWithDelay = pbStart + pb.duracao + DELAY;
    if (startTimeInMinutes < pbEndWithDelay && endTimeInMinutes > pbStart) {
      return { available: false, message: "Horário temporariamente reservado." };
    }
  }

  return { available: true, message: "Disponível" };
}

/**
 * Busca ou cria customer no Asaas, sincronizando dados do profile
 */
async function getOrCreateAsaasCustomer(
  apiKey: string,
  user: { id: string; email: string; user_metadata?: any },
  supabaseAdmin: any
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    access_token: apiKey,
  };

  // Buscar dados atualizados do profile (fonte real de CPF/nome)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nome, cpf, telefone")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.nome || user.user_metadata?.nome || user.user_metadata?.full_name || user.email.split("@")[0];
  const cpf = profile?.cpf?.replace(/\D/g, "") || user.user_metadata?.cpf || undefined;

  // Buscar por email no Asaas
  const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(user.email)}`, {
    headers,
  });
  const searchData = await searchRes.json();

  if (searchData.data?.length > 0) {
    const existingCustomer = searchData.data[0];

    // Sincronizar dados se CPF ou nome mudou
    if (cpf && (!existingCustomer.cpfCnpj || existingCustomer.cpfCnpj !== cpf || existingCustomer.name !== name)) {
      console.log("[create-asaas-pix] Atualizando customer no Asaas:", existingCustomer.id);
      await fetch(`${ASAAS_BASE_URL}/customers/${existingCustomer.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name,
          cpfCnpj: cpf,
        }),
      });
    }

    return existingCustomer.id;
  }

  // Criar novo customer
  const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      email: user.email,
      cpfCnpj: cpf,
      externalReference: user.id,
    }),
  });

  const createData = await createRes.json();
  if (createData.errors) {
    console.error("[create-asaas-pix] Customer creation error:", createData.errors);
    throw new Error("Erro ao criar cliente no Asaas: " + JSON.stringify(createData.errors));
  }

  return createData.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY não configurada");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Autenticar usuário
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const body = await req.json();
    const { bookingData, rescheduleFromId } = body;

    if (!bookingData) throw new Error("bookingData é obrigatório");

    console.log("[create-asaas-pix] Iniciando PIX para:", {
      servico: bookingData.serviceName,
      data: bookingData.data,
      hora: bookingData.hora,
      preco: bookingData.preco,
    });

    // 1. Verificar disponibilidade
    const avail = await checkTimeSlotAvailability(
      supabaseAdmin,
      bookingData.data,
      bookingData.hora,
      bookingData.duracao,
      rescheduleFromId,
      bookingData.barbeiro_id,
      user.id
    );

    if (!avail.available) {
      return new Response(
        JSON.stringify({ error: avail.message, code: "TIME_SLOT_UNAVAILABLE" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
      );
    }

    // 2. Limpar pending_bookings expirados ou do mesmo usuário para este slot
    await supabaseAdmin
      .from("pending_bookings")
      .delete()
      .eq("user_id", user.id)
      .eq("data", bookingData.data)
      .eq("barbeiro_id", bookingData.barbeiro_id);

    // Limpar expirados globalmente para este slot
    await supabaseAdmin
      .from("pending_bookings")
      .delete()
      .eq("data", bookingData.data)
      .eq("hora", bookingData.hora)
      .eq("barbeiro_id", bookingData.barbeiro_id)
      .lt("expires_at", new Date().toISOString());

    // Criar pending_booking para reservar horário (30 min)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const { data: pendingBooking, error: pbError } = await supabaseAdmin
      .from("pending_bookings")
      .insert({
        user_id: user.id,
        servico_id: bookingData.servico_id,
        barbeiro_id: bookingData.barbeiro_id,
        data: bookingData.data,
        hora: bookingData.hora,
        duracao: bookingData.duracao,
        preco: bookingData.preco,
        observacoes: bookingData.observacoes || null,
        payment_method: "pix",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (pbError) {
      console.error("[create-asaas-pix] Pending booking error:", pbError);
      throw new Error("Erro ao reservar horário");
    }

    // 3. Buscar/criar customer no Asaas
    const customerId = await getOrCreateAsaasCustomer(asaasApiKey, user, supabaseAdmin);
    console.log("[create-asaas-pix] Asaas customer:", customerId);

    // 4. Criar cobrança PIX no Asaas
    const dueDate = new Date();
    dueDate.setMinutes(dueDate.getMinutes() + 30);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: bookingData.preco,
        dueDate: dueDateStr,
        description: `Agendamento: ${bookingData.serviceName || "Serviço"} - ${bookingData.data} às ${bookingData.hora}`,
        externalReference: pendingBooking.id,
      }),
    });

    const paymentData = await paymentRes.json();
    if (paymentData.errors) {
      // Limpar pending booking
      await supabaseAdmin.from("pending_bookings").delete().eq("id", pendingBooking.id);
      console.error("[create-asaas-pix] Payment error:", paymentData.errors);
      throw new Error("Erro ao gerar cobrança PIX: " + JSON.stringify(paymentData.errors));
    }

    console.log("[create-asaas-pix] Payment created:", paymentData.id);

    // 5. Buscar QR Code PIX
    const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
    });

    const qrData = await qrRes.json();
    if (!qrData.encodedImage || !qrData.payload) {
      console.error("[create-asaas-pix] QR Code error:", qrData);
      // Não limpa pending pois o pagamento foi criado
      throw new Error("Erro ao gerar QR Code PIX");
    }

    console.log("[create-asaas-pix] QR Code gerado com sucesso");

    // 6. Salvar referência do pagamento Asaas no pending_booking
    await supabaseAdmin
      .from("pending_bookings")
      .update({
        asaas_payment_id: paymentData.id,
        pix_qr_code: qrData.encodedImage,
        pix_payload: qrData.payload,
      })
      .eq("id", pendingBooking.id);

    // 7. Retornar dados do PIX
    return new Response(
      JSON.stringify({
        success: true,
        pendingBookingId: pendingBooking.id,
        asaasPaymentId: paymentData.id,
        pixQrCode: qrData.encodedImage,
        pixPayload: qrData.payload,
        expiresAt: expiresAt.toISOString(),
        value: bookingData.preco,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[create-asaas-pix] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
