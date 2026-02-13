import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Mapeamento de planos internos (Supabase) para preços do Stripe
 */
const PLAN_PRICE_MAP: Record<string, string> = {
  "b78adffc-da65-4085-8305-0386e1e9d962": "price_1T08CFLN5yQChZnofK09gVvo", // Plano só Barba R$79.99
  "f37ec929-292e-41e9-b0e4-80476983a946": "price_1T08CTLN5yQChZnoKElcmMyj", // Plano Só Corte R$89.99
  "77a1da4d-698b-462b-b864-57bc30985f93": "price_1T08CnLN5yQChZnoWC3gISr1", // Corte + Sobrancelha R$99.90
  "d292ce6c-1d9d-4741-83e2-5ba0540ce805": "price_1T08D9LN5yQChZnoeP4Srz0p", // Plano Corte + Barba R$129.99
};

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
  barbeiro_id?: string | null
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
    return { available: false, message: `Horário fora do expediente.` };
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

  const { data: pending } = await supabase
    .from("pending_bookings")
    .select("id, hora, duracao")
    .eq("data", data)
    .gt("expires_at", new Date().toISOString());

  for (const pb of pending || []) {
    const pbStart = timeToMinutes(pb.hora);
    const pbEndWithDelay = pbStart + pb.duracao + DELAY;
    if (startTimeInMinutes < pbEndWithDelay && endTimeInMinutes > pbStart) {
      return { available: false, message: "Horário temporariamente reservado." };
    }
  }

  return { available: true, message: "Disponível" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const body = await req.json();
    const origin = req.headers.get("origin") || "https://dubagenda.lovable.app";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Buscar ou reusar customer do Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // ========== SUBSCRIPTION CHECKOUT ==========
    if (body.planoId) {
      const stripePriceId = PLAN_PRICE_MAP[body.planoId];
      if (!stripePriceId) throw new Error("Plano não encontrado no Stripe");

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        metadata: {
          type: "subscription",
          plan_id: body.planoId,
          user_id: user.id,
        },
        success_url: `${origin}/cliente?stripe_success=subscription&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/cliente/assinar`,
      });

      console.log("[create-checkout] Subscription session:", session.id);
      return new Response(
        JSON.stringify({ url: session.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ========== BOOKING CHECKOUT (PIX/CARD) ==========
    if (body.bookingData) {
      const { bookingData, paymentMethod, rescheduleFromId } = body;

      // Verificar disponibilidade antes de criar pending
      const avail = await checkTimeSlotAvailability(
        supabaseAdmin,
        bookingData.data,
        bookingData.hora,
        bookingData.duracao,
        rescheduleFromId,
        bookingData.barbeiro_id
      );

      if (!avail.available) {
        return new Response(
          JSON.stringify({ error: avail.message, code: "TIME_SLOT_UNAVAILABLE" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }

      // Criar pending_booking para reservar o horário
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
          payment_method: paymentMethod || "card",
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (pbError) {
        console.error("[create-checkout] Error creating pending booking:", pbError);
        throw new Error("Erro ao reservar horário");
      }

      // Criar sessão do Stripe Checkout para pagamento avulso
      // Não especificar payment_method_types — Stripe usa automaticamente
      // os métodos habilitados no dashboard para a moeda BRL
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: `Agendamento - ${bookingData.serviceName || "Serviço"}`,
                description: `${bookingData.data} às ${bookingData.hora}`,
              },
              unit_amount: Math.round(bookingData.preco * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          type: "booking",
          pending_booking_id: pendingBooking.id,
          reschedule_from_id: rescheduleFromId || "",
          user_id: user.id,
        },
        success_url: `${origin}/cliente/agendar?stripe_success=booking&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/cliente/agendar?stripe_cancelled=true`,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      });

      console.log("[create-checkout] Booking session:", session.id, "method:", paymentMethod);

      return new Response(
        JSON.stringify({ url: session.url, pendingBookingId: pendingBooking.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error("Dados inválidos: envie planoId ou bookingData");
  } catch (error) {
    console.error("[create-checkout] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
