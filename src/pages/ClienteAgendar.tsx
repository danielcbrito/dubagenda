import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BackArrow } from "@/components/ui/back-arrow";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Clock, Check, Tag, CreditCard, Landmark, Loader2, Calendar as CalendarIcon, Shield, Zap, Star, Store, ChevronRight, Crown, Wallet, MapPin } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";
import pixIcon from "@/assets/pix-icon.png";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { format, eachDayOfInterval, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { sendRemarcacaoConcluidaEvent } from "@/lib/webhookService";
import { motion, AnimatePresence } from "framer-motion";

// Premium Components
import { ServiceCard } from "@/components/booking/ServiceCard";
import { BarberCard } from "@/components/booking/BarberCard";
import { useBarberRatings } from "@/hooks/useBarberRatings";
import { TimeSlot } from "@/components/booking/TimeSlot";
import { PaymentOption } from "@/components/booking/PaymentOption";
import { SummaryRow } from "@/components/booking/SummaryRow";
import { PremiumCalendar } from "@/components/booking/PremiumCalendar";
import { StepDots } from "@/components/booking/StepDots";
import { BookingBottomBar } from "@/components/booking/BookingBottomBar";
import { TimeSelectionBar } from "@/components/booking/TimeSelectionBar";
import { FloatingActionBar } from "@/components/booking/FloatingActionBar";
import { UnitSelector } from "@/components/booking/UnitSelector";
import { NextAvailableDateButton } from "@/components/booking/NextAvailableDateButton";

interface TenantUnit {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_sede: boolean | null;
}

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
  tenant_id?: string | null;
  unidade_id?: string | null;
}

interface Service {
  id: string;
  nome: string;
  descricao: string;
  duracao_minutos: number;
  preco: number;
}

interface ActiveSubscription {
  id: string;
  plano_id: string;
  plano_nome: string;
  limite_agendamentos_mes: number;
  agendamentos_usados: number;
  next_billing_date: string;
  status: string;
  servico_id: string | null;
  servico: Service | null;
  barbeiro_id: string | null;
  barbeiro: Barber | null;
}

interface AppointmentValidationPayload {
  valid?: boolean;
  message?: string;
  data?: {
    valid?: boolean;
    message?: string;
  };
}

function normalizeTimeValue(time?: string | null) {
  if (!time) return "";
  const [hours = "00", minutes = "00"] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function normalizeAppointmentValidation(
  payload: AppointmentValidationPayload | null | undefined,
) {
  const resolved = payload?.data ?? payload;

  return {
    valid: Boolean(resolved?.valid),
    message: resolved?.message,
  };
}

const ClienteAgendar = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'pix' | 'wallet'>('cash');
  const [walletBalance, setWalletBalance] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
  const servicesListRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [subscriptionLimitReached, setSubscriptionLimitReached] = useState(false);
  const [availableRedemptions, setAvailableRedemptions] = useState<{ id: string; promocao_id: string }[]>([]);
  const [useRedemption, setUseRedemption] = useState(false);
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  
  // Durações personalizadas do barbeiro selecionado (servico_id → duracao)
  const [barberCustomDurations, setBarberCustomDurations] = useState<Record<string, number>>({});
  
  // Dias fechados no calendário (barbearia/barbeiro não trabalha)
  const [closedDates, setClosedDates] = useState<Date[]>([]);
  const [closedDatesLoading, setClosedDatesLoading] = useState(false);
  
  // Estados para cupom de desconto
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; percent: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  
  // Indica se o usuário está usando fluxo de plano (serviço pré-selecionado)
  const [isPlanFlow, setIsPlanFlow] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Barbearia preferida do usuário (multi-tenant)
  const [preferredShop, setPreferredShop] = useState<{ id: string; nome: string } | null>(null);
  const [showingOtherShops, setShowingOtherShops] = useState(false);
  const [allBarbers, setAllBarbers] = useState<Barber[]>([]);

  // Sistema de unidades
  const [tenantUnits, setTenantUnits] = useState<TenantUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<TenantUnit | null>(null);
  const [preferredUnitId, setPreferredUnitId] = useState<string | null>(null);
  const [hasMultipleUnits, setHasMultipleUnits] = useState(false);

  // Verificação se usuário pode usar o plano
  const isPlanEligible =
    !isRescheduling &&
    isPlanFlow &&
    !!activeSubscription?.servico_id &&
    (selectedServices?.length ?? 0) === 1 &&
    selectedServices?.[0]?.id === activeSubscription.servico_id &&
    activeSubscription.agendamentos_usados < activeSubscription.limite_agendamentos_mes;

  // Avaliações dos barbeiros
  const { ratings: barberRatings } = useBarberRatings(barbers.map(b => b.id));

  /** Retorna a duração efetiva de um serviço (personalizada do barbeiro ou padrão) */
  const getEffectiveDuration = useCallback((service: Service) => {
    return barberCustomDurations[service.id] ?? service.duracao_minutos;
  }, [barberCustomDurations]);

  const totalDuration = (selectedServices || []).reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);

  // Fonte única do barbeiro selecionado (fallback para assinatura vinculada)
  const selectedBarberId = selectedBarber?.id || activeSubscription?.barbeiro_id || null;
  const availabilityTenantId = selectedBarber?.tenant_id ?? (preferredShop?.id ?? null);

  const { 
    slots: availableSlots, 
    loading: loadingSlots, 
    refreshSlots
  } = useSlotAvailability(
    selectedDate, 
    totalDuration,
    isRescheduling ? rescheduleAppointmentId : null,
    selectedBarberId,
    availabilityTenantId
  );

  // Evita horário "stale": se o slot selecionado sumir da lista atual, limpa seleção
  useEffect(() => {
    if (step !== 4 || !selectedTime || loadingSlots) return;

    const normalizedSelectedTime = normalizeTimeValue(selectedTime);
    const selectedStillAvailable = availableSlots.some(
      (slot) => slot.available && normalizeTimeValue(slot.time) === normalizedSelectedTime
    );

    if (!selectedStillAvailable) {
      setSelectedTime("");
      setUnavailableMessage("Esse horário acabou de ficar indisponível. Escolha outro.");
    }
  }, [step, selectedTime, availableSlots, loadingSlots]);

  // Carregar durações personalizadas do barbeiro
  const loadBarberCustomDurations = useCallback(async (barberId: string) => {
    try {
      const { data, error } = await supabase
        .from("barbeiro_servico_duracao")
        .select("servico_id, duracao_personalizada")
        .eq("barbeiro_id", barberId);
      
      if (error) throw error;
      
      const durations: Record<string, number> = {};
      (data || []).forEach(d => {
        durations[d.servico_id] = d.duracao_personalizada;
      });
      setBarberCustomDurations(durations);
    } catch (err) {
      console.error("Error loading barber custom durations:", err);
      setBarberCustomDurations({});
    }
  }, []);

  // Carregar barbeiros (filtrado pelo tenant da barbearia preferida e opcionalmente pela unidade)
  const loadBarbers = async (tenantId?: string | null, unitId?: string | null) => {
    // Busca filtrada + todos em paralelo
    let query = supabase
      .from("barbeiros")
      .select("id, apelido, foto_url, tenant_id, unidade_id")
      .eq("ativo", true)
      .order("apelido");

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    } else {
      query = query.is("tenant_id", null);
    }

    // Filtrar por unidade se selecionada
    if (unitId) {
      query = query.or(`unidade_id.eq.${unitId},unidade_id.is.null`);
    }

    const allQuery = supabase
      .from("barbeiros")
      .select("id, apelido, foto_url, tenant_id, unidade_id")
      .eq("ativo", true)
      .order("apelido");

    const [filtered, all] = await Promise.all([query, allQuery]);
    setBarbers(filtered.data || []);
    setAllBarbers(all.data || []);
    return filtered.data || [];
  };

  // Carregar unidades do tenant
  const loadTenantUnits = async (tenantId: string) => {
    const { data } = await supabase
      .from("tenant_unidades")
      .select("id, nome, bairro, cidade, estado, is_sede")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .order("is_sede", { ascending: false });
    
    const units = (data || []) as TenantUnit[];
    setTenantUnits(units);
    setHasMultipleUnits(units.length > 1);
    return units;
  };

  // Initialize booking
  useEffect(() => {
    const initializeBooking = async () => {
      setIsInitializing(true);
      try {

      // SINGLE session call — reused everywhere
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      if (uid) setUserId(uid);

      // Carregar barbearia preferida + unidade preferida do perfil
      let tenantId: string | null = null;
      let userPreferredUnitId: string | null = null;
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("barbearia_preferida_id, unidade_preferida_id")
          .eq("id", uid)
          .single();

        if (profile?.barbearia_preferida_id) {
          tenantId = profile.barbearia_preferida_id;
          userPreferredUnitId = (profile as any).unidade_preferida_id || null;
          setPreferredUnitId(userPreferredUnitId);
          // Buscar nome da barbearia (non-blocking — will set state async)
          supabase
            .from("tenants")
            .select("id, nome")
            .eq("id", tenantId)
            .single()
            .then(({ data: tenant }) => { if (tenant) setPreferredShop(tenant); });
        }
      }

      // Check fast session-storage flags BEFORE heavy queries
      const resumePaymentRaw = sessionStorage.getItem("resumeToPaymentStep");
      const isReschedulingSession = sessionStorage.getItem('isRescheduling');
      const appointmentId = sessionStorage.getItem('rescheduleAppointmentId');
      const barberFromParam = searchParams.get("barber");

      // Rescheduling — early exit, minimal queries
      if (isReschedulingSession === 'true' && appointmentId) {
        setIsRescheduling(true);
        setRescheduleAppointmentId(appointmentId);
        loadAppointmentForReschedule(appointmentId);
        setIsInitializing(false);
        return;
      }

      // Carregar unidades do tenant + MEGA PARALLEL
      let units: TenantUnit[] = [];
      let effectiveUnitId: string | null = null;
      
      if (tenantId) {
        units = await loadTenantUnits(tenantId);
        console.log("[initializeBooking] Units loaded:", units.length, "tenantId:", tenantId);
        
        // Se tem unidade preferida e ela está nas unidades ativas, auto-selecionar
        if (userPreferredUnitId && units.find(u => u.id === userPreferredUnitId)) {
          const preferredUnit = units.find(u => u.id === userPreferredUnitId)!;
          setSelectedUnit(preferredUnit);
          effectiveUnitId = preferredUnit.id;
        }
      }

      const [barbersList, , , subscription] = await Promise.all([
        loadBarbers(tenantId, effectiveUnitId),
        loadUserCreditsOptimized(uid),
        loadAvailableRedemptionsOptimized(uid),
        loadActiveSubscriptionOptimized(uid),
      ]);

      // Auto-select barber from query param
      if (barberFromParam && barbersList) {
        const matchedBarber = barbersList.find((b: Barber) => b.id === barberFromParam);
        if (matchedBarber) {
          setSelectedBarber(matchedBarber);
          loadBarberCustomDurations(matchedBarber.id); // non-blocking
          setSearchParams(prev => {
            prev.delete("barber");
            return prev;
          }, { replace: true });
        }
      }

      // Resume payment step
      if (resumePaymentRaw) {
        sessionStorage.removeItem("resumeToPaymentStep");
        try {
          const resumeData = JSON.parse(resumePaymentRaw);
          
          const [, resumeBarberResult, resumeServiceResult] = await Promise.all([
            loadServices(tenantId),
            resumeData.barberId ? supabase.from("barbeiros").select("id, apelido, foto_url, tenant_id").eq("id", resumeData.barberId).maybeSingle() : null,
            resumeData.servicoId ? supabase.from("servicos").select("*").eq("id", resumeData.servicoId).maybeSingle() : null,
          ]);
          
          if (resumeBarberResult?.data) {
            setSelectedBarber(resumeBarberResult.data);
            loadBarberCustomDurations(resumeBarberResult.data.id);
          }
          if (resumeServiceResult?.data) setSelectedServices([resumeServiceResult.data]);
          if (resumeData.date) setSelectedDate(new Date(`${resumeData.date}T12:00:00`));
          if (resumeData.time) setSelectedTime(normalizeTimeValue(resumeData.time));

          setStep(5);
          setIsInitializing(false);
          return;
        } catch (e) {
          console.error("Erro ao restaurar dados de pagamento:", e);
        }
      }

      if (subscription) {
        const restantes = subscription.limite_agendamentos_mes - subscription.agendamentos_usados;

        if (restantes > 0) {
          if (subscription.barbeiro) {
            setSelectedBarber(subscription.barbeiro);
            loadBarberCustomDurations(subscription.barbeiro.id); // non-blocking
          }

          let includedService: Service | null = subscription.servico;

          if (!includedService && subscription.servico_id) {
            const { data: fallbackServico } = await supabase
              .from("servicos")
              .select("id, nome, descricao, duracao_minutos, preco")
              .eq("id", subscription.servico_id)
              .maybeSingle();

            includedService = fallbackServico || null;
          }

          // Plano ativo SEM serviço válido vinculado → bloquear fluxo para evitar seleção indevida
          if (!includedService) {
            setSubscriptionBlocked(true);
            toast.error("Seu plano não possui um serviço válido vinculado. Fale com o suporte da barbearia.");
            setIsInitializing(false);
            return;
          }

          setIsPlanFlow(true);
          setSelectedServices([includedService]);
          if (subscription.barbeiro) {
            setStep(3); // barber + service pre-selected → date
          } else {
            setStep(1); // go to barber selection
          }
          setIsInitializing(false);
          return;
        }

        setSubscriptionLimitReached(true);
        setIsInitializing(false);
        return;
      }

      await loadServices(tenantId);

      // Normal flow: if multiple units and no preferred, start at unit selection (step 0)
      // Otherwise start at barber selection (step 1)
      console.log("[initializeBooking] Decision:", { unitsCount: units.length, effectiveUnitId, hasMultipleUnits: units.length > 1 });
      setStep(1);
      setIsInitializing(false);
      } catch (err) {
        console.error("[initializeBooking] Fatal error:", err);
        setIsInitializing(false);
        // Fallback: try to show unit selection or barber selection
        setStep(1);
      }
    };

    initializeBooking();
  }, []);

  // Dynamic viewport height for mobile browsers (without locking scroll)
  useEffect(() => {
    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setFullHeight();
    window.addEventListener('resize', setFullHeight);

    return () => {
      window.removeEventListener('resize', setFullHeight);
    };
  }, []);

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    if (selectedDate) {
      setUnavailableMessage(null);
    }
  }, [selectedDate]);

  // Verificar retorno do Asaas Checkout (cartão - booking)
  useEffect(() => {
    const asaasSuccess = searchParams.get("asaas_success");
    const pendingId = searchParams.get("pending_id");

    if (asaasSuccess === "booking" && pendingId) {
      const verifyPayment = async () => {
        setProcessingPayment(true);
        try {
          // Polling para verificar se o pagamento foi confirmado via webhook
          const { data, error } = await supabase.functions.invoke("asaas-webhook", {
            body: { action: "check", pendingBookingId: pendingId },
          });

          if (error) throw error;

          if (data?.status === "paid" || data?.status === "already_processed") {
            sessionStorage.removeItem("isRescheduling");
            sessionStorage.removeItem("rescheduleAppointmentId");
            toast.success("Agendamento confirmado com sucesso!");
            navigate("/cliente");
          } else {
            // Pagamento ainda pendente - mostrar mensagem e iniciar polling
            toast.info("Pagamento sendo processado. Aguarde a confirmação.");
            navigate("/cliente");
          }
        } catch (err: any) {
          console.error("Asaas verification error:", err);
          toast.error("Erro ao verificar pagamento: " + (err.message || ""));
        } finally {
          setProcessingPayment(false);
          searchParams.delete("asaas_success");
          searchParams.delete("pending_id");
          setSearchParams(searchParams, { replace: true });
        }
      };
      verifyPayment();
    }
  }, []);

  const loadServices = async (tenantId?: string | null) => {
    // Buscar serviços e IDs vinculados a planos em paralelo
    let query = supabase
      .from("servicos")
      .select("*")
      .eq("ativo", true)
      .order("preco");

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    } else {
      query = query.is("tenant_id", null);
    }

    const { data: allServices } = await query;

    // Todos os serviços ativos do tenant são exibidos — serviços vinculados a planos
    // também ficam disponíveis para agendamento avulso
    setServices(allServices || []);
  };

  const loadUserCreditsOptimized = async (uid: string | null) => {
    if (!uid) return;
    try {
      // Ensure session is fresh before calling edge functions
      await supabase.auth.refreshSession();

      // Parallel: credits RPC + wallet edge function
      const [creditsResult, walletResult] = await Promise.all([
        supabase.rpc("get_user_available_credits", { p_user_id: uid }),
        supabase.functions.invoke('wallet-operations', { body: { action: 'get_balance' } }),
      ]);

      setAvailableCredits(creditsResult.data || 0);
      setWalletBalance(walletResult.data?.balance || 0);
    } catch (error) {
      console.error("Error loading credits:", error);
    }
  };

  const loadAvailableRedemptionsOptimized = async (uid: string | null) => {
    if (!uid) return;
    try {
      // Parallel: check active resgate appointments + available redemptions
      const [activeRes, redemptionsRes] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("id")
          .eq("user_id", uid)
          .eq("payment_method", "resgate")
          .in("status", ["pending", "confirmed", "completed"])
          .limit(1),
        supabase
          .from("resgates")
          .select("id, promocao_id")
          .eq("user_id", uid)
          .eq("status", "available")
          .is("used_at", null),
      ]);

      if (activeRes.data && activeRes.data.length > 0) {
        setAvailableRedemptions([]);
        return;
      }
      setAvailableRedemptions(redemptionsRes.data || []);
    } catch (error) {
      console.error("Error loading redemptions:", error);
    }
  };

  const loadActiveSubscriptionOptimized = async (uid: string | null): Promise<ActiveSubscription | null> => {
    if (!uid) return null;
    try {
      const { data: subscriptions, error } = await supabase
        .from("assinaturas")
        .select(`
          id,
          plano_id,
          next_billing_date,
          status,
          barbeiro_id,
          plano:planos(nome, limite_agendamentos_mes, servico_id)
        `)
        .eq("user_id", uid)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      const subscription = subscriptions?.[0] || null;

      if (error) {
        console.error('[loadActiveSubscription] Erro na query:', error.message);
        return null;
      }
      if (!subscription || !subscription.plano) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const billingDate = new Date(subscription.next_billing_date + 'T12:00:00');
      billingDate.setHours(0, 0, 0, 0);
      
      if (today > billingDate) {
        setSubscriptionBlocked(true);
        toast.error("Seu plano está vencido. Regularize o pagamento para continuar agendando.");
        return null;
      }

      const planoData = subscription.plano as any;

      // Calcular início do ciclo atual (next_billing_date - 1 mês)
      const cycleStart = new Date(`${subscription.next_billing_date}T12:00:00`);
      cycleStart.setMonth(cycleStart.getMonth() - 1);
      const cycleStartDate = cycleStart.toISOString().split('T')[0];

      // Fonte de verdade do consumo: mesma regra do banco/trigger
      const [usageRes, servicoRes, barbeiroRes] = await Promise.all([
        supabase.rpc('count_subscription_uses_in_cycle', {
          p_assinatura_id: subscription.id,
          p_cycle_start: cycleStartDate,
          p_cycle_end: subscription.next_billing_date,
        }),
        planoData.servico_id
          ? supabase.from("servicos").select("id, nome, descricao, duracao_minutos, preco").eq("id", planoData.servico_id).single()
          : Promise.resolve({ data: null }),
        subscription.barbeiro_id
          ? supabase.from("barbeiros").select("id, apelido, foto_url, tenant_id").eq("id", subscription.barbeiro_id).single()
          : Promise.resolve({ data: null }),
      ]);

      const usedCount = usageRes.error ? 0 : Number(usageRes.data || 0);

      const activeSubscriptionData: ActiveSubscription = {
        id: subscription.id,
        plano_id: subscription.plano_id,
        plano_nome: planoData.nome,
        limite_agendamentos_mes: planoData.limite_agendamentos_mes,
        agendamentos_usados: usedCount,
        next_billing_date: subscription.next_billing_date,
        status: subscription.status,
        servico_id: planoData.servico_id || null,
        servico: servicoRes.data as Service | null,
        barbeiro_id: subscription.barbeiro_id || null,
        barbeiro: barbeiroRes.data as Barber | null,
      };

      setActiveSubscription(activeSubscriptionData);
      return activeSubscriptionData;
    } catch (error) {
      console.error("Error loading active subscription:", error);
      return null;
    }
  };

  // Legacy wrappers (used elsewhere in the component)
  const loadUserCredits = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return loadUserCreditsOptimized(session?.user?.id || null);
  };

  const loadAvailableRedemptions = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return loadAvailableRedemptionsOptimized(session?.user?.id || null);
  };

  const loadActiveSubscription = async (): Promise<ActiveSubscription | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return loadActiveSubscriptionOptimized(session?.user?.id || null);
  };

  const loadAppointmentForReschedule = async (appointmentId: string) => {
    try {
      const { data: appointment, error } = await supabase
        .from("agendamentos")
        .select(`*, servico:servicos(*), barbeiro:barbeiros(id, apelido, foto_url, tenant_id)`)
        .eq("id", appointmentId)
        .single();

      if (error) throw error;
      if (!appointment) {
        toast.error("Agendamento não encontrado");
        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');
        return;
      }

      setSelectedServices([appointment.servico]);
      // Pré-selecionar o barbeiro do agendamento original
      if (appointment.barbeiro) {
        setSelectedBarber(appointment.barbeiro);
        await loadBarberCustomDurations(appointment.barbeiro.id);
      }
      setStep(3);
      toast.info("Escolha a nova data e horário");
    } catch (error) {
      console.error("Error loading appointment for reschedule:", error);
      toast.error("Erro ao carregar agendamento");
      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');
    }
  };

  const toggleService = (service: Service) => {
    // Em fluxo de plano com serviço vinculado, bloqueia alteração de serviços adicionais
    if (isPlanFlow && !!activeSubscription?.servico_id) return;

    setSelectedServices(prev => {
      const existing = prev || [];
      const exists = existing.find(s => s.id === service.id);
      if (exists) {
        setServiceQuantities(q => {
          const copy = { ...q };
          delete copy[service.id];
          return copy;
        });
        return existing.filter(s => s.id !== service.id);
      } else {
        setServiceQuantities(q => ({ ...q, [service.id]: 1 }));
        return [...existing, service];
      }
    });
  };

  /**
   * Carrega os dias fechados para o mês visível no calendário.
   */
  
  const loadClosedDates = useCallback(async (monthStart: Date, monthEnd: Date) => {
    setClosedDatesLoading(true);
    try {
      const barbeiroId = selectedBarberId || null;
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

      // Parallelizar TODAS as queries de configuração + exceções
      const [configResult, globalExcResult, barberExcResult] = await Promise.all([
        barbeiroId
          ? supabase.from('configuracoes_horario_barbeiro').select('dia_semana, aberto').eq('barbeiro_id', barbeiroId)
          : supabase.from('configuracoes_horario').select('dia_semana, aberto'),
        supabase.from('horarios_excepcionais').select('data, aberto').gte('data', startStr).lte('data', endStr),
        barbeiroId
          ? supabase.from('horarios_excepcionais_barbeiro').select('data, aberto').eq('barbeiro_id', barbeiroId).gte('data', startStr).lte('data', endStr)
          : Promise.resolve({ data: null }),
      ]);

      let weeklyClosedDays: number[] = [];
      
      if (barbeiroId && configResult.data && configResult.data.length > 0) {
        weeklyClosedDays = configResult.data.filter(c => c.aberto === false).map(c => c.dia_semana);
      } else if (!barbeiroId && configResult.data) {
        weeklyClosedDays = configResult.data.filter(c => !c.aberto).map(c => c.dia_semana);
      } else if (barbeiroId) {
        // Fallback: barber has no config, fetch global
        const { data: globalConfig } = await supabase.from('configuracoes_horario').select('dia_semana, aberto');
        weeklyClosedDays = (globalConfig || []).filter(c => !c.aberto).map(c => c.dia_semana);
      }

      const exceptionMap: Record<string, boolean> = {};
      for (const exc of globalExcResult.data || []) {
        exceptionMap[exc.data] = exc.aberto;
      }
      // Barber exceptions override global
      for (const exc of barberExcResult.data || []) {
        exceptionMap[exc.data] = exc.aberto ?? true;
      }

      const closed: Date[] = [];
      for (const day of allDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);

        if (dateStr in exceptionMap) {
          if (!exceptionMap[dateStr]) closed.push(day);
        } else if (weeklyClosedDays.includes(dayOfWeek)) {
          closed.push(day);
        }
      }

      setClosedDates(closed);
    } catch (error) {
      console.error('[loadClosedDates] Erro:', error);
    } finally {
      setClosedDatesLoading(false);
    }
  }, [selectedBarberId]);

  // ─── syncBookingData: recarrega serviços, barbeiros e dias fechados ───
  // Chamado on-demand (ao entrar no passo 3 e ao selecionar data), não mais via Realtime
  const syncBookingData = useCallback(async () => {
    const tenantId = selectedBarber?.tenant_id ?? (preferredShop?.id ?? null);
    try {
      let servicesQuery = supabase.from("servicos").select("*").eq("ativo", true).order("preco");
      let barbersQuery = supabase.from("barbeiros").select("id, apelido, foto_url, tenant_id, unidade_id").eq("ativo", true).order("apelido");

      if (tenantId) {
        servicesQuery = servicesQuery.eq("tenant_id", tenantId);
        barbersQuery = barbersQuery.eq("tenant_id", tenantId);
      } else {
        servicesQuery = servicesQuery.is("tenant_id", null);
        barbersQuery = barbersQuery.is("tenant_id", null);
      }

      const [{ data: nextServices }, { data: nextBarbers }] = await Promise.all([
        servicesQuery,
        barbersQuery,
      ]);

      const safeServices = nextServices || [];
      const safeBarbers = nextBarbers || [];

      setServices(safeServices);
      setBarbers(safeBarbers);
      // Para fluxo de plano, NÃO remover o serviço pré-selecionado do plano
      if (!isPlanFlow) {
        setSelectedServices((prev) => prev.filter((service) => safeServices.some((item) => item.id === service.id)));
      }

      if (selectedBarberId) {
        const refreshedBarber = safeBarbers.find((barber) => barber.id === selectedBarberId) || null;
        setSelectedBarber(refreshedBarber);
      }

      const baseDate = selectedDate || new Date();
      const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      await loadClosedDates(monthStart, monthEnd);
      refreshSlots();
    } catch (error) {
      console.error("[syncBookingData] Erro ao sincronizar dados:", error);
    }
  }, [selectedBarber?.tenant_id, preferredShop?.id, selectedBarberId, selectedDate, isPlanFlow, loadClosedDates, refreshSlots]);

  // ─── Canal Realtime: apenas agendamentos (conflitos de slot em tempo real) ───
  useEffect(() => {
    if (isInitializing) return;

    const channel = supabase
      .channel(`cliente-agendar-slots-${selectedBarberId ?? 'none'}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agendamentos',
        ...(selectedBarberId ? { filter: `barbeiro_id=eq.${selectedBarberId}` } : {}),
      }, () => {
        // Outro cliente reservou/cancelou um slot → atualizar disponibilidade
        refreshSlots();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isInitializing, selectedBarberId, refreshSlots]);

  // ─── Canal Realtime: Assinatura do usuário (ativação em tempo real) ───
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`assinatura-agendar-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assinaturas',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const updated = payload.new as any;
          console.log('[ClienteAgendar] Assinatura atualizada:', updated.status);

          if (updated.status === 'active') {
            toast.success('🎉 Seu plano foi ativado! A opção de pagamento via plano já está disponível.');
            const sub = await loadActiveSubscriptionOptimized(userId);
            if (sub) {
              setSubscriptionBlocked(false);
              setSubscriptionLimitReached(false);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[ClienteAgendar] Erro no canal de assinatura');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const incrementServiceQty = (serviceId: string) => {
    if (isPlanFlow && !!activeSubscription?.servico_id) return;

    setServiceQuantities(q => ({
      ...q,
      [serviceId]: Math.min((q[serviceId] || 1) + 1, 5)
    }));
  };

  const decrementServiceQty = (service: Service) => {
    if (isPlanFlow && !!activeSubscription?.servico_id) return;

    const current = serviceQuantities[service.id] || 1;
    if (current <= 1) {
      toggleService(service);
    } else {
      setServiceQuantities(q => ({
        ...q,
        [service.id]: current - 1
      }));
    }
  };

  const handleNextStep = async () => {
    // FLUXO: Unit(0) → Barber(1) → Service(2) → Date(3) → Time(4) → Payment(5) → Confirm(6)

    // Step 0: Validate unit selection → go to barber
    if (step === 0) {
      if (!selectedUnit) {
        toast.error("Selecione uma unidade");
        return;
      }
      // Reload barbers filtered by unit
      await loadBarbers(preferredShop?.id || null, selectedUnit.id);
      setStep(1);
      return;
    }

    // Step 1: Validate barber → go to service
    if (step === 1) {
      if (!selectedBarberId) {
        toast.error("Selecione um profissional");
        return;
      }
      // Load custom durations for the selected barber
      if (selectedBarber) {
        await loadBarberCustomDurations(selectedBarber.id);
      }
      // If plan has service pre-selected, skip service step
      if (isPlanFlow && activeSubscription?.servico_id) {
        syncBookingData(); // Refresh data entering date step
        setStep(3); // Skip to date
        return;
      }
      // Load services filtered by tenant
      await loadServices(preferredShop?.id || null);
      setStep(2); // Go to service selection
      return;
    }

    // Step 2: Validate services
    if (step === 2) {
      if (selectedServices.length === 0) {
        toast.error("Selecione pelo menos um serviço");
        return;
      }
      syncBookingData(); // Refresh data entering date step
      setStep(3);
      return;
    }

    // Step 3: Validate date
    if (step === 3) {
      if (!selectedDate) {
        toast.error("Selecione uma data");
        return;
      }
      setStep(4);
      return;
    }

    // Step 4: Validate time selection (availability is validated server-side in atomic-booking)
    if (step === 4) {
      if (!selectedTime) {
        toast.error("Selecione um horário");
        return;
      }

      const normalizedSelectedTime = normalizeTimeValue(selectedTime);
      const selectedStillAvailable = availableSlots.some(
        (slot) => slot.available && normalizeTimeValue(slot.time) === normalizedSelectedTime
      );

      if (!selectedStillAvailable) {
        setSelectedTime("");
        toast.error("Esse horário ficou indisponível. Escolha outro horário.");
        refreshSlots();
        return;
      }

      // Reschedule or Plan: go to confirmation (step 5)
      if (isRescheduling || isPlanEligible) {
        setStep(5);
        return;
      }

      // Normal flow: check if credits cover total
      const totalPrice = getTotalPrice();
      if (availableCredits >= totalPrice) {
        setPaymentMethod('cash');
        setStep(6); // Skip payment, go to confirmation
        return;
      }

      setStep(5); // Go to payment selection
      return;
    }

    // Step 5 (normal): payment → confirmation
    setStep(step + 1);
  };

  const handlePayment = async () => {
    if (!selectedDate || !selectedTime || selectedServices.length === 0) {
      toast.error("Dados do agendamento inválidos");
      return;
    }

    if (isPlanEligible) {
      await createAppointmentWithPlan();
      return;
    }

    const totalPrice = getTotalPrice();
    const finalPrice = Math.max(0, totalPrice - availableCredits);

    if (totalPrice === 0 && useRedemption) {
      await createAppointmentWithRedemption();
      return;
    }

    if (finalPrice === 0) {
      await createAppointmentWithCredits(totalPrice);
      return;
    }

    setProcessingPayment(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const totalDuration = selectedServices.reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);
      const serviceNames = selectedServices.map(s => {
        const qty = serviceQuantities[s.id] || 1;
        return qty > 1 ? `${s.nome} x${qty}` : s.nome;
      }).join(", ");

      const bookingTime = normalizeTimeValue(selectedTime);
      const mainService = selectedServices[0];
      const bookingData = {
        servico_id: mainService.id,
        barbeiro_id: selectedBarberId || null,
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora: bookingTime,
        duracao: totalDuration,
        preco: finalPrice,
        serviceName: serviceNames,
        observacoes: selectedServices.length > 1 
          ? `Serviços: ${serviceNames}` 
          : undefined,
        unidade_id: selectedUnit?.id || null,
      };

      // === Cartão via Asaas Checkout ===
      if (paymentMethod === 'card') {
        const { data, error } = await supabase.functions.invoke('create-asaas-card', {
          body: {
            bookingData,
            rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error("Não foi possível iniciar o pagamento.");
      }

      // === Pagamento via Carteira (wallet) — suporta pagamento parcial ===
      if (paymentMethod === 'wallet') {
        const walletDebit = Math.min(walletBalance, finalPrice);
        const remainderCash = finalPrice - walletDebit;

        const payload: any = {
          bookingData: {
            ...bookingData,
            preco: finalPrice,
          },
          metodo: remainderCash > 0 ? 'cash' : 'wallet',
          creditsUsed: 0,
          rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
        };

        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: payload,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Debit wallet (only the available amount)
        if (walletDebit > 0) {
          const { data: walletResult, error: walletError } = await supabase.functions.invoke('wallet-operations', {
            body: {
              action: 'pay_service',
              amount: walletDebit,
              appointmentId: data.appointmentId,
            },
          });

          if (walletError || walletResult?.error) {
            throw new Error(walletResult?.error || "Erro ao debitar carteira");
          }
        }

        if (appliedCoupon && data.appointmentId) {
          await registerCouponUsage(data.appointmentId);
        }

        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');

        if (remainderCash > 0) {
          toast.success(`R$ ${walletDebit.toFixed(2)} debitado da carteira. Pague R$ ${remainderCash.toFixed(2)} na barbearia.`);
        } else {
          toast.success("Agendamento criado! Pagamento debitado da carteira.");
        }
        navigate("/cliente");
        return;
      }

      // === Pagamento na Barbearia (cash) ===
      const payload: any = {
        bookingData,
        metodo: 'cash',
        creditsUsed: Math.min(availableCredits, totalPrice),
        rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
      };

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (availableCredits > 0 && data.appointmentId) {
        await useCredits(Math.min(availableCredits, totalPrice), data.appointmentId);
      }

      if (useRedemption && data.appointmentId) {
        await markRedemptionAsUsed(data.appointmentId);
      }

      if (appliedCoupon && data.appointmentId) {
        await registerCouponUsage(data.appointmentId);
      }

      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');
      
      // Webhook de confirmação é enviado automaticamente pelo trigger do banco de dados
      
      toast.success("Agendamento criado! Pague na barbearia.");
      navigate("/cliente");
    } catch (error: any) {
      console.error('Payment error:', error);
      
      if (error.message?.includes('TIME_SLOT_UNAVAILABLE') || error.message?.includes('indisponível') || error.message?.includes('Horário')) {
        toast.error(error.message || "Horário indisponível. Escolha outro horário.");
        setStep(4);
        refreshSlots();
      } else {
        toast.error("Erro ao processar pagamento: " + (error.message || "Erro desconhecido"));
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const createAppointmentWithRedemption = async () => {
    setProcessingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const totalDuration = selectedServices.reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);
      const serviceNames = selectedServices.map(s => {
        const qty = serviceQuantities[s.id] || 1;
        return qty > 1 ? `${s.nome} x${qty}` : s.nome;
      }).join(", ");
      const mainService = selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');
      const bookingTime = normalizeTimeValue(selectedTime);

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: { data: dateStr, hora: bookingTime, duracao: totalDuration, userId: session.user.id, barberId: selectedBarberId }
      });

      const resolvedValidation = normalizeAppointmentValidation(validation);

      if (validationError || !resolvedValidation.valid) {
        toast.error(resolvedValidation.message || "Horário indisponível. Escolha outro.");
        setStep(4);
        refreshSlots();
        return;
      }

      const { data: appointment, error: aptError } = await supabase
        .from("agendamentos")
        .insert({
          user_id: session.user.id,
          servico_id: mainService.id,
          barbeiro_id: selectedBarberId || null,
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          preco: 0,
          status: "confirmed",
          observacoes: `Corte grátis - Resgate do programa de fidelidade. ${selectedServices.length > 1 ? 'Serviços: ' + serviceNames : ''}`,
          payment_method: 'resgate',
          is_free: true,
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          unidade_id: selectedUnit?.id || null,
        } as any)
        .select()
        .single();

      if (aptError) throw aptError;

      await markRedemptionAsUsed(appointment.id);

      // Webhook de confirmação é enviado automaticamente pelo trigger do banco de dados

      toast.success("Corte grátis resgatado com sucesso!");
      navigate("/cliente");
    } catch (error: any) {
      console.error('Error creating appointment with redemption:', error);
      toast.error("Erro ao criar agendamento: " + (error.message || "Erro desconhecido"));
    } finally {
      setProcessingPayment(false);
    }
  };

  const createAppointmentWithCredits = async (totalPrice: number) => {
    setProcessingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const totalDuration = selectedServices.reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);
      const serviceNames = selectedServices.map(s => {
        const qty = serviceQuantities[s.id] || 1;
        return qty > 1 ? `${s.nome} x${qty}` : s.nome;
      }).join(", ");
      const mainService = selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');
      const bookingTime = normalizeTimeValue(selectedTime);

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          userId: session.user.id,
          barberId: selectedBarberId,
          excludeAppointmentId: isRescheduling ? rescheduleAppointmentId : undefined
        }
      });

      if (validationError) {
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }

      const resolvedValidation = normalizeAppointmentValidation(validation);

      if (!resolvedValidation.valid) {
        toast.error(resolvedValidation.message || "Horário indisponível. Escolha outro horário.");
        setStep(4);
        refreshSlots();
        return;
      }

      if (isRescheduling && rescheduleAppointmentId) {
        await supabase
          .from("agendamentos")
          .update({ 
            status: 'cancelled_by_user' as any,
            visivel_para_usuario: false
          } as any)
          .eq("id", rescheduleAppointmentId);
      }

      const creditUsedAmount = Math.min(availableCredits, totalPrice);
      const observacoesText = selectedServices.length > 1 
        ? `Serviços: ${serviceNames}. Pago com crédito do app: R$ ${creditUsedAmount.toFixed(2)}`
        : `Pago com crédito do app: R$ ${creditUsedAmount.toFixed(2)}`;

      const { data: appointment, error: aptError } = await supabase
        .from("agendamentos")
        .insert({
          user_id: session.user.id,
          servico_id: mainService.id,
          barbeiro_id: selectedBarberId || null,
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          preco: 0,
          status: "confirmed",
          observacoes: observacoesText,
          payment_method: 'credit',
          is_free: true,
          remarcado_de: isRescheduling ? rescheduleAppointmentId : null,
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          unidade_id: selectedUnit?.id || null,
        } as any)
        .select()
        .single();

      if (aptError) throw aptError;

      await supabase
        .from("pagamentos")
        .insert({
          user_id: session.user.id,
          agendamento_id: appointment.id,
          metodo: "cash",
          valor: 0,
          status: "paid",
        });

      await useCredits(totalPrice, appointment.id);

      if (useRedemption) {
        await markRedemptionAsUsed(appointment.id);
      }

      // Registra uso do cupom se aplicado
      if (appliedCoupon) {
        await registerCouponUsage(appointment.id);
      }

      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');

      // Webhook de confirmação é enviado automaticamente pelo trigger do banco de dados

      toast.success("Agendamento criado! Créditos aplicados com sucesso.");
      navigate("/cliente");
    } catch (error: any) {
      console.error('Error creating appointment with credits:', error);
      toast.error("Erro ao criar agendamento: " + (error.message || "Erro desconhecido"));
    } finally {
      setProcessingPayment(false);
    }
  };

  const createAppointmentWithPlan = async () => {
    if (!activeSubscription) {
      toast.error("Assinatura não encontrada");
      return;
    }

    setProcessingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const totalDuration = selectedServices.reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);
      const serviceNames = selectedServices.map(s => {
        const qty = serviceQuantities[s.id] || 1;
        return qty > 1 ? `${s.nome} x${qty}` : s.nome;
      }).join(", ");
      const mainService = selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');
      const bookingTime = normalizeTimeValue(selectedTime);

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          userId: session.user.id,
          barberId: selectedBarberId
        }
      });

      if (validationError) {
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }

      const resolvedValidation = normalizeAppointmentValidation(validation);

      if (!resolvedValidation.valid) {
        toast.error(resolvedValidation.message || "Horário indisponível. Escolha outro horário.");
        setStep(4);
        refreshSlots();
        return;
      }

      const { data: appointment, error: aptError } = await supabase
        .from("agendamentos")
        .insert({
          user_id: session.user.id,
          servico_id: mainService.id,
          barbeiro_id: selectedBarberId || null,
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          preco: 0,
          status: "confirmed",
          observacoes: `Agendamento via ${activeSubscription.plano_nome}. ${selectedServices.length > 1 ? 'Serviços: ' + serviceNames : ''}`,
          payment_method: 'plano',
          tipo_agendamento: 'plano',
          is_free: true,
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          unidade_id: selectedUnit?.id || null,
        } as any)
        .select()
        .single();

      if (aptError) throw aptError;

      await supabase
        .from("pagamentos")
        .insert({
          user_id: session.user.id,
          agendamento_id: appointment.id,
          metodo: "cash",
          valor: 0,
          status: "paid",
        });

      // Webhook de confirmação é enviado automaticamente pelo trigger do banco de dados

      toast.success(`Agendamento criado! Usando seu ${activeSubscription.plano_nome}.`);
      navigate("/cliente");
      } catch (error: any) {
      console.error('Error creating appointment with plan:', error);

      if (error.message?.includes('PLAN_LIMIT_REACHED')) {
        setSubscriptionLimitReached(true);
        toast.error('Seu plano já atingiu o limite deste ciclo.');
      } else if (error.message?.includes('PLAN_BOOKING_OUT_OF_PERIOD')) {
        toast.error('Esse agendamento está fora do período válido do seu plano.');
      } else {
        toast.error("Erro ao criar agendamento: " + (error.message || "Erro desconhecido"));
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const useCredits = async (amount: number, appointmentId: string) => {
    if (!userId || amount <= 0) return;

    try {
      const { data, error } = await supabase.rpc('use_credits_atomic', {
        p_user_id: userId,
        p_appointment_id: appointmentId,
        p_amount: amount
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; used_amount?: number } | null;

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao debitar créditos');
      }

      setAvailableCredits(prev => Math.max(0, prev - amount));
    } catch (error) {
      console.error("Error using credits:", error);
      throw error;
    }
  };

  const markRedemptionAsUsed = async (appointmentId: string) => {
    if (!useRedemption || availableRedemptions.length === 0) return;
    
    const redemptionToUse = availableRedemptions[0];
    try {
      const { error } = await supabase
        .from("resgates")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
          appointment_id: appointmentId
        })
        .eq("id", redemptionToUse.id);

      if (error) throw error;
      
      setAvailableRedemptions(prev => prev.filter(r => r.id !== redemptionToUse.id));
      setUseRedemption(false);
    } catch (error) {
      console.error("Error marking redemption as used:", error);
    }
  };

  /** Valida cupom de desconto no banco de dados */
  const validateCoupon = async (codeOverride?: string) => {
    const code = (codeOverride ?? couponCode).trim().toUpperCase();
    if (!code || code.length < 3) return;

    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("discount_coupons")
        .select("id, code, percent, starts_at, expires_at, active")
        .ilike("code", code)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Cupom inválido");
        return;
      }

      if (!data.active) {
        toast.error("Este cupom está inativo");
        return;
      }

      const now = new Date();
      if (data.starts_at && new Date(data.starts_at) > now) {
        toast.error("Este cupom ainda não está válido");
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < now) {
        toast.error("Este cupom expirou");
        return;
      }

      setAppliedCoupon({ id: data.id, code: data.code, percent: data.percent });
      toast.success(`Cupom aplicado! ${data.percent}% de desconto`);
    } catch (err: any) {
      console.error("Error validating coupon:", err);
      toast.error("Erro ao validar cupom");
    } finally {
      setValidatingCoupon(false);
    }
  };

  /** Remove cupom aplicado */
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  /** Registra o uso do cupom após confirmação do agendamento */
  const registerCouponUsage = async (appointmentId: string) => {
    if (!appliedCoupon || !userId) return;
    try {
      await supabase
        .from("discount_coupon_redemptions")
        .insert({
          coupon_id: appliedCoupon.id,
          user_id: userId,
          appointment_id: appointmentId,
        });
    } catch (err) {
      console.error("Error registering coupon usage:", err);
    }
  };

  const handleRescheduleUpdate = async () => {
    if (!rescheduleAppointmentId || !selectedDate || !selectedTime) {
      toast.error("Dados incompletos para remarcação");
      return;
    }

    setProcessingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const totalDuration = selectedServices.reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const bookingTime = normalizeTimeValue(selectedTime);
      
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          userId: session.user.id,
          barberId: selectedBarberId,
          excludeAppointmentId: rescheduleAppointmentId
        }
      });

      if (validationError) {
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }

      const resolvedValidation = normalizeAppointmentValidation(validation);

      if (!resolvedValidation.valid) {
        toast.error(resolvedValidation.message || "Horário indisponível. Escolha outro horário.");
        setStep(4);
        refreshSlots();
        return;
      }
      
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          status: 'confirmed',
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", rescheduleAppointmentId);

      if (error) throw error;

      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');

      const { data: profile } = await supabase.from('profiles').select('nome, telefone').eq('id', session.user.id).single();
      const mainService = selectedServices[0];
      sendRemarcacaoConcluidaEvent({
        agendamento_id: rescheduleAppointmentId,
        cliente_id: session.user.id,
        cliente_nome: profile?.nome || session.user.email || 'Cliente',
        servico: mainService?.nome || 'Serviço',
        data: dateStr,
        hora: selectedTime,
        preco: mainService?.preco
      });

      toast.success("Agendamento remarcado com sucesso!");
      navigate("/cliente");
    } catch (error: any) {
      console.error("Error rescheduling:", error);
      toast.error("Erro ao remarcar: " + (error.message || "Erro desconhecido"));
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTotalDuration = () => {
    return selectedServices.reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);
  };

  /** Calcula o horário de término baseado no horário de início + duração total */
  const getEndTime = () => {
    if (!selectedTime) return "";
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + getTotalDuration();
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;
  };

  const getCorteService = () => {
    return selectedServices.find(s => 
      s.nome.toLowerCase().includes('corte') && 
      !s.nome.toLowerCase().includes('barba')
    );
  };

  // Helper para formatar nomes dos serviços com quantidade
  const getFormattedServiceNames = () => {
    return selectedServices.map(s => {
      const qty = serviceQuantities[s.id] || 1;
      return qty > 1 ? `${s.nome} x${qty}` : s.nome;
    }).join(", ");
  };

  const getRedemptionDiscount = () => {
    if (!useRedemption || availableRedemptions.length === 0) return 0;
    const corteService = getCorteService();
    if (!corteService) return 0;
    return corteService.preco;
  };

  const getTotalPrice = () => {
    const baseTotal = selectedServices.reduce((sum, s) => sum + s.preco * (serviceQuantities[s.id] || 1), 0);
    const redemptionDiscount = getRedemptionDiscount();
    const afterRedemption = Math.max(0, baseTotal - redemptionDiscount);
    // Aplica cupom de desconto sobre o valor restante
    if (appliedCoupon) {
      return Math.max(0, afterRedemption * (1 - appliedCoupon.percent / 100));
    }
    return afterRedemption;
  };

  /** Retorna o valor base SEM cupom (para exibição) */
  const getBaseTotalBeforeCoupon = () => {
    const baseTotal = selectedServices.reduce((sum, s) => sum + s.preco * (serviceQuantities[s.id] || 1), 0);
    const redemptionDiscount = getRedemptionDiscount();
    return Math.max(0, baseTotal - redemptionDiscount);
  };

  /** Retorna o valor do desconto do cupom */
  const getCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    const base = getBaseTotalBeforeCoupon();
    return base * (appliedCoupon.percent / 100);
  };

  const canUseRedemption = availableRedemptions.length > 0 && !!getCorteService();

  const handleBack = () => {
    // Step 1 (Barbeiro) — volta para home
    if (step <= 1) {
      navigate("/cliente");
      return;
    }

    // Step 2 (Serviço) — volta para barbeiro
    if (step === 2) {
      setStep(1);
      return;
    }

    // Step 3 (Data) — volta para serviço ou home
    if (step === 3) {
      if ((isPlanFlow && activeSubscription?.barbeiro && activeSubscription?.servico_id) || isRescheduling) {
        navigate("/cliente"); // Primeira etapa visível
      } else if (isPlanFlow && activeSubscription?.servico_id) {
        // Service pre-selected by plan, barber was step 1
        setStep(1);
      } else {
        setStep(2);
      }
      return;
    }

    // Demais steps: voltar um
    setStep(step - 1);
  };

  const planNeedsService = isPlanFlow && !activeSubscription?.servico_id;

  // Build visible steps for the current flow (unit step removed — always skip)
  const visibleSteps = (() => {
    const skipBarber = (isPlanFlow && activeSubscription?.barbeiro) || isRescheduling;
    const skipService = (isPlanFlow && activeSubscription?.servico_id) || isRescheduling;

    const steps: number[] = [];
    if (!skipBarber) steps.push(1); // Barber
    if (!skipService) steps.push(2); // Service
    steps.push(3); // Date
    steps.push(4); // Time
    if (!isPlanFlow && !isRescheduling) steps.push(5); // Payment
    steps.push(isPlanFlow || isRescheduling ? 5 : 6); // Confirm
    return [...new Set(steps)];
  })();

  const totalSteps = visibleSteps.length;
  const currentDisplayStep = Math.max(1, visibleSteps.indexOf(step) + 1);

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  // Loading gate — mesmo visual do PageLoader (Suspense) para transição seamless
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Tela de Limite Atingido - para quando o usuário já usou todos os agendamentos do plano
  if (subscriptionLimitReached) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
            <Clock className="w-10 h-10 text-destructive" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Limite do Plano Atingido
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Você já utilizou todos os {activeSubscription?.limite_agendamentos_mes || 4} agendamentos 
            do seu plano <span className="text-primary font-semibold">{activeSubscription?.plano_nome}</span> neste ciclo.
          </p>
          
          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Agendamentos usados</span>
              <span className="text-foreground font-semibold">
                {activeSubscription?.agendamentos_usados}/{activeSubscription?.limite_agendamentos_mes}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-6">
            O limite será renovado no próximo período de cobrança.
          </p>
          
          <button
            onClick={() => navigate("/cliente")}
            className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
          >
            Voltar para Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header fixo — Seta + Dots */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-background/90 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <button 
                onClick={handleBack}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-card/60 hover:bg-card transition-all active:scale-90"
              >
                <BackArrow size={18} className="text-foreground/70" />
              </button>

              <StepDots currentStep={currentDisplayStep} totalSteps={totalSteps} />

              <div className="w-8" />
            </div>
          </div>
        </div>
        {/* Fade mask — cards desaparecem suavemente ao rolar */}
        <div 
          className="h-8 pointer-events-none -mt-[1px]"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background) / 0.85), transparent)" }}
        />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* STEP 1: ESCOLHER BARBEIRO */}
        {step === 1 && (
          <motion.div
            key="step-1-barber"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-16 pb-32 px-4"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Seu Profissional
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  Quem vai cuidar de você hoje?
                </p>
              </div>

              {barbers.length === 0 ? (
                <div className="rounded-xl border border-border/20 p-6 text-center bg-card/30">
                  <div className="w-8 h-8 rounded-lg bg-muted/10 mx-auto flex items-center justify-center mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground/30 animate-spin" />
                  </div>
                  <p className="text-[11px] text-muted-foreground/40">Carregando...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {barbers.map((barber) => (
                    <BarberCard
                      key={barber.id}
                      barber={barber}
                      isSelected={selectedBarber?.id === barber.id}
                      onSelect={() => {
                        setSelectedBarber(barber);
                        loadBarberCustomDurations(barber.id);
                      }}
                      rating={barberRatings[barber.id] || null}
                      isPlanBarber={activeSubscription?.barbeiro_id === barber.id}
                    />
                  ))}
                </div>
              )}
            </div>

            <FloatingActionBar
              isVisible={!!selectedBarber}
              onContinue={handleNextStep}
              label="Continuar"
              subtitle={selectedBarber ? selectedBarber.apelido : ""}
              icon={
                selectedBarber?.foto_url ? (
                  <img src={selectedBarber.foto_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-[11px] font-bold text-primary">
                    {selectedBarber?.apelido?.charAt(0)}
                  </div>
                )
              }
            />
          </motion.div>
        )}

        {/* STEP 2: ESCOLHER SERVIÇO */}
        {step === 2 && (
          <motion.div
            key="step-2-services"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="min-h-screen pt-16 pb-32 px-4"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  O que deseja?
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  Selecione um ou mais serviços{selectedBarber ? ` • com ${selectedBarber.apelido}` : ''}
                </p>
              </div>

              <div ref={servicesListRef} className="space-y-3">
                {services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    isSelected={selectedServices.some(s => s.id === service.id)}
                    quantity={serviceQuantities[service.id] || 0}
                    effectiveDuration={barberCustomDurations[service.id]}
                    onToggle={() => toggleService(service)}
                    onIncrement={() => incrementServiceQty(service.id)}
                    onDecrement={() => decrementServiceQty(service)}
                    isPlanService={!!activeSubscription?.servico_id && activeSubscription.servico_id === service.id}
                  />
                ))}
              </div>

              <BookingBottomBar
                serviceCount={selectedServices.reduce((sum, s) => sum + (serviceQuantities[s.id] || 1), 0)}
                totalDuration={getTotalDuration()}
                totalPrice={getTotalPrice()}
                onContinue={handleNextStep}
                isVisible={selectedServices.length > 0}
              />
            </div>
          </motion.div>
        )}

        {/* STEP 3: ESCOLHER DATA */}
        {step === 3 && (
          <motion.div
            key="step-date"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-16 pb-24 px-4"
          >
             <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-8 pt-3">
                <h2 className="text-xl font-semibold text-foreground">
                  Melhor dia pra você
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1.5">
                  {isPlanFlow && activeSubscription ? (
                    <>
                      <span className="text-primary font-semibold">{activeSubscription.plano_nome}</span>
                      {(() => {
                        const serviceName = activeSubscription.servico?.nome || getFormattedServiceNames();
                        return serviceName && serviceName.toLowerCase() !== activeSubscription.plano_nome?.toLowerCase()
                          ? ` • ${serviceName}` : "";
                      })()}
                      {selectedBarber ? ` • ${selectedBarber.apelido}` : ""}
                    </>
                  ) : selectedBarber ? (
                    <>com {selectedBarber.apelido}</>
                  ) : (
                    "Selecione o dia desejado"
                  )}
                </p>
              </div>

              <PremiumCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date); syncBookingData(); }}
                closedDates={closedDates}
                onMonthChange={loadClosedDates}
                loading={closedDatesLoading}
              />

            <FloatingActionBar
              isVisible={!!selectedDate}
              onContinue={handleNextStep}
              label="Continuar"
              subtitle={selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : ""}
              icon={<CalendarIcon className="w-4 h-4 text-primary" />}
            />
            </div>
          </motion.div>
        )}

        {/* STEP 4: ESCOLHER HORÁRIO */}
        {step === 4 && (
          <motion.div
            key="step-time"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-16 pb-32 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Que horas fica bom?
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  {selectedDate ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR }) : ""} • {selectedBarber?.apelido}
                </p>
              </div>

              {loadingSlots ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-primary animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">Carregando horários de {selectedBarber?.apelido}...</p>
                </div>
              ) : availableSlots.filter(slot => slot.available).length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  {(() => {
                    // Detectar motivo: dia fechado (closedDates ou sem slots gerados) vs agenda cheia
                    const isClosedDay = selectedDate && closedDates.some(
                      d => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                    );
                    const noSlotsGenerated = availableSlots.length === 0;
                    const allOccupied = availableSlots.length > 0 && availableSlots.every(s => !s.available);

                    if (isClosedDay || noSlotsGenerated) {
                      return (
                        <p className="text-muted-foreground font-medium mb-4">
                          {selectedBarber?.apelido} não atende neste dia.
                        </p>
                      );
                    }
                    if (allOccupied) {
                      return (
                        <p className="text-muted-foreground font-medium mb-4">
                          Agenda cheia neste dia. Tente outro horário ou profissional.
                        </p>
                      );
                    }
                    return (
                      <p className="text-muted-foreground font-medium mb-4">
                        {selectedBarber?.apelido} está com agenda cheia neste dia.
                      </p>
                    );
                  })()}
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={() => setStep(3)}
                      className="px-6 py-3 border border-border rounded-xl text-foreground hover:bg-secondary transition-all"
                    >
                      Escolher outra data
                    </button>
                    <NextAvailableDateButton
                      selectedDate={selectedDate}
                      barberId={selectedBarber?.id}
                      onSelectDate={(d) => {
                        setSelectedDate(d);
                        setSelectedTime("");
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {availableSlots.filter(slot => slot.available).map((slot) => (
                      <TimeSlot
                        key={slot.time}
                        time={slot.time}
                        isSelected={selectedTime === slot.time}
                        isDisabled={false}
                        onSelect={() => {
                          setSelectedTime(slot.time);
                          setUnavailableMessage(null);
                        }}
                      />
                    ))}
                  </div>

                  {/* Premium Time Selection Bar */}
                  <TimeSelectionBar
                    selectedDate={selectedDate || null}
                    selectedTime={selectedTime}
                    formattedDate={selectedDate ? format(selectedDate, 'd/MM') : ''}
                    onContinue={handleNextStep}
                    isVisible={!!selectedTime}
                    isLoading={loading}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 5: Pagamento (APENAS para usuários SEM plano) */}
        {step === 5 && !isRescheduling && !isPlanFlow && (
          <motion.div
            key="step-4"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-16 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Header */}
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Como prefere pagar?
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  Escolha a forma mais confortável
                </p>
              </div>

              {/* Resumo do serviço */}
              <div className="bg-card border border-border/30 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      {getFormattedServiceNames()}
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                      {getTotalDuration()} min • {selectedBarber?.apelido} • {selectedDate ? format(selectedDate, "dd/MM", { locale: ptBR }) : ""} às {selectedTime} → {getEndTime()}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[10px] text-muted-foreground/40">R$</span>
                    <span className="text-[15px] font-bold text-foreground tabular-nums">
                      {selectedServices.reduce((sum, s) => sum + s.preco * (serviceQuantities[s.id] || 1), 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pagar na Barbearia */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => { setPaymentMethod('cash'); setUseRedemption(false); }}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-all",
                  paymentMethod === 'cash' && !useRedemption
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/20 bg-card/50 hover:border-border/40"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    paymentMethod === 'cash' && !useRedemption ? "bg-primary/10" : "bg-muted/20"
                  )}>
                    <Landmark className={cn(
                      "w-5 h-5 transition-colors",
                      paymentMethod === 'cash' && !useRedemption ? "text-primary" : "text-muted-foreground/30"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground/70">Pagar na Barbearia</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                      Pagamento presencial no dia
                    </p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                    paymentMethod === 'cash' && !useRedemption
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/20"
                  )}>
                    {paymentMethod === 'cash' && !useRedemption && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                  </div>
                </div>
              </motion.button>

              {/* Pagar com Saldo da Carteira */}
              {walletBalance > 0 && (() => {
                const totalPrice = getTotalPrice();
                const coversAll = walletBalance >= totalPrice;
                const remainder = Math.max(0, totalPrice - walletBalance);
                const walletDebit = Math.min(walletBalance, totalPrice);
                const isSelected = paymentMethod === 'wallet' && !useRedemption;

                return (
                  <>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setPaymentMethod('wallet'); setUseRedemption(false); }}
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition-all mt-3",
                        isSelected
                          ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                          : "border-border/20 bg-card/50 hover:border-border/40"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-emerald-500/10" : "bg-muted/20"
                        )}>
                          <Wallet className={cn(
                            "w-5 h-5 transition-colors",
                            isSelected ? "text-emerald-500" : "text-muted-foreground/30"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground/70">Pagar com Carteira</p>
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                            Saldo disponível: R$ {walletBalance.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-muted-foreground/20"
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                        </div>
                      </div>
                    </motion.button>

                    {/* Breakdown detalhado — só aparece quando selecionado */}
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 mx-1 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground/60">Valor do serviço</span>
                          <span className="text-[12px] font-medium text-foreground/70 tabular-nums">
                            R$ {totalPrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-emerald-500/80">Descontado da carteira</span>
                          <span className="text-[12px] font-semibold text-emerald-500 tabular-nums">
                            − R$ {walletDebit.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <div className="border-t border-border/30 pt-2">
                          <div className="flex items-center justify-between">
                            {coversAll ? (
                              <>
                                <span className="text-[11px] font-medium text-emerald-500/90">✓ Coberto pela carteira</span>
                                <span className="text-[13px] font-bold text-emerald-500 tabular-nums">R$ 0,00</span>
                              </>
                            ) : (
                              <>
                                <span className="text-[11px] font-medium text-foreground/70">Pagar na barbearia</span>
                                <span className="text-[13px] font-bold text-foreground tabular-nums">
                                  R$ {remainder.toFixed(2).replace('.', ',')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </>
                );
              })()}

              {/* Resgate Grátis */}
              {canUseRedemption && (
                <div className="mt-5">
                  <button
                    onClick={() => setUseRedemption(!useRedemption)}
                    className={cn(
                      "w-full text-left rounded-xl p-4 transition-all border",
                      useRedemption 
                        ? "bg-emerald-500/5 border-emerald-500/30 ring-1 ring-emerald-500/10" 
                        : "bg-card/50 border-secondary/20 hover:border-secondary/40"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                        <Star className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-foreground">Corte Grátis</p>
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary px-1.5 py-px rounded">
                            Disponível
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {availableRedemptions.length} resgate{availableRedemptions.length > 1 ? 's' : ''} de fidelidade
                        </p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                        useRedemption 
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-secondary/30"
                      )}>
                        {useRedemption && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Cupom de Desconto */}
              <div className="mt-5">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <div>
                        <span className="text-[12px] font-semibold text-foreground">{appliedCoupon.code}</span>
                        <span className="text-[10px] text-emerald-400/80 ml-1.5">-{appliedCoupon.percent}%</span>
                      </div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors font-medium px-2 py-1"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Tem um cupom? Insira aqui"
                      value={couponCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setCouponCode(val);
                        if (val.trim().length >= 3) {
                          clearTimeout((window as any).__couponDebounce);
                          (window as any).__couponDebounce = setTimeout(() => {
                            validateCoupon(val);
                          }, 600);
                        }
                      }}
                      className="w-full pl-10 pr-10 py-3 bg-card border border-border/30 rounded-xl text-foreground placeholder-muted-foreground/30 focus:outline-none focus:border-primary/40 text-[12px] uppercase tracking-wider transition-colors"
                    />
                    {validatingCoupon && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                        <div className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}

        {/* Confirmação Plano */}
        {isPlanFlow && step === 5 && (
          <motion.div
            key="step-plan-confirmation"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-16 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Confirmar Agendamento
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Revise os detalhes do seu horário
                </p>
              </div>

              {/* Card de resumo - Layout limpo para plano */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-6">
                <SummaryRow 
                  label="Serviço"
                  value={getFormattedServiceNames()}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Duração"
                  value={`${getTotalDuration()} minutos`}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Horário"
                  value={`${selectedTime} → ${getEndTime()}`}
                />
              </div>

              {/* Card do Plano - Destaque elegante */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{activeSubscription?.plano_nome}</p>
                    <p className="text-sm text-muted-foreground">Plano ativo</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-primary/20">
                  <span className="text-sm text-muted-foreground">Agendamentos no plano</span>
                  <span className="text-sm font-semibold text-foreground">
                    {(activeSubscription?.agendamentos_usados || 0) + 1}/{activeSubscription?.limite_agendamentos_mes || 4}
                  </span>
                </div>
              </div>

              <FloatingActionBar
                isVisible={true}
                onContinue={handlePayment}
                label={processingPayment ? 'Agendando...' : 'Confirmar'}
                isLoading={processingPayment}
                loadingLabel="Agendando..."
                icon={<Check className="w-4 h-4 text-primary" />}
                subtitle={activeSubscription?.plano_nome}
              />
            </div>
          </motion.div>
        )}

        {/* Step 6: Confirmação (Usuários normais SEM plano) - oculta quando QR Code PIX é gerado */}
        {step === 6 && !isRescheduling && !isPlanFlow && (
          <motion.div
            key="step-5"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-16 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Tudo certo?
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  Revise e confirme seu agendamento
                </p>
              </div>

              {/* Card de resumo */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-6">
                <SummaryRow 
                  label="Serviço"
                  value={getFormattedServiceNames()}
                />

                <div className="border-t border-border" />

                <SummaryRow 
                  label="Duração"
                  value={`${getTotalDuration()} minutos`}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Horário"
                  value={`${selectedTime} → ${getEndTime()}`}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Forma de Pagamento"
                  value={
                    useRedemption && getTotalPrice() === 0 ? "Resgate de Fidelidade" :
                    paymentMethod === 'wallet' && walletBalance >= getTotalPrice() ? "Carteira do App" :
                    paymentMethod === 'wallet' && walletBalance < getTotalPrice() ? `Carteira (R$ ${walletBalance.toFixed(2).replace('.', ',')}) + Barbearia (R$ ${(getTotalPrice() - walletBalance).toFixed(2).replace('.', ',')})` :
                    availableCredits >= getTotalPrice() ? "Créditos do App" :
                    "Pagar na Barbearia"
                  }
                />

                {/* Cupom aplicado */}
                {appliedCoupon && getCouponDiscount() > 0 && (
                  <>
                    <div className="border-t border-border" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-400 font-medium">Cupom {appliedCoupon.code} ({appliedCoupon.percent}%)</span>
                      <span className="text-sm font-semibold text-emerald-400">-R$ {getCouponDiscount().toFixed(2).replace('.', ',')}</span>
                    </div>
                  </>
                )}
                
                <div className="border-t border-border mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-muted-foreground">Total</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] text-muted-foreground/50">R$</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <FloatingActionBar
                isVisible={true}
                onContinue={handlePayment}
                label={processingPayment ? 'Processando...' : 'Confirmar'}
                isLoading={processingPayment}
                loadingLabel="Processando..."
                icon={<Check className="w-4 h-4 text-primary" />}
                subtitle={`R$ ${Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}`}
              />
            </div>
          </motion.div>
        )}

        {/* Step 5: Confirmação Remarcação */}
        {step === 5 && isRescheduling && (
          <motion.div
            key="step-5-reschedule"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-16 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Confirmar Remarcação
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Revise os novos dados
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-6">
                <SummaryRow 
                  label="Nova Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Novo Horário"
                  value={`${selectedTime} → ${getEndTime()}`}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Serviço"
                  value={selectedServices[0]?.nome || ""}
                />
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-primary text-center">
                  O pagamento existente permanecerá válido
                </p>
              </div>

              <FloatingActionBar
                isVisible={true}
                onContinue={handleRescheduleUpdate}
                label={processingPayment ? 'Remarcando...' : 'Confirmar'}
                isLoading={processingPayment}
                loadingLabel="Remarcando..."
                icon={<Check className="w-4 h-4 text-primary" />}
                subtitle="Remarcação"
              />
            </div>
          </motion.div>
        )}

        {/* PIX step removed - migrated to Stripe */}
      </AnimatePresence>

      {/* Floating Bottom Bar — Step 5 Pagamento */}
      <AnimatePresence>
        {step === 5 && !isRescheduling && !isPlanFlow && paymentMethod && (
          <motion.div
            key="bar-payment"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40"
          >
            {/* Subtle top fade */}
            <div 
              className="h-16 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
            />

            {/* Bar content */}
            <div className="bg-background border-t border-border/40 px-5 pb-safe">
              <div className="pt-3.5 pb-4 space-y-3">
                {/* Info row */}
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2.5">
                    {paymentMethod === "pix" ? (
                      <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
                    ) : paymentMethod === "card" ? (
                      <CreditCard className="w-5 h-5 text-primary" />
                    ) : paymentMethod === "wallet" ? (
                      <Wallet className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Landmark className="w-5 h-5 text-primary" />
                    )}
                    <span className="text-[12px] text-muted-foreground/70">
                      {paymentMethod === "pix" ? "Pagar via Pix" : paymentMethod === "card" ? "Pagar via Cartão" : paymentMethod === "wallet" ? "Pagar via Carteira" : "Pagar na Barbearia"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] text-muted-foreground/50 font-medium">R$</span>
                    <span className="text-[17px] font-bold text-foreground tabular-nums tracking-tight">
                      {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                {/* Full-width CTA */}
                <motion.button
                  onClick={() => {
                    if (paymentMethod === 'pix' || paymentMethod === 'card') {
                      handlePayment();
                    } else {
                      setStep(6);
                    }
                  }}
                  disabled={processingPayment}
                  whileTap={{ scale: processingPayment ? 1 : 0.985 }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2",
                    "h-[50px] rounded-xl",
                    "font-semibold text-[14px] text-primary-foreground",
                    "bg-primary",
                    "active:brightness-90 transition-all duration-150",
                    processingPayment && "opacity-70 cursor-wait"
                  )}
                  style={{
                    boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)"
                  }}
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {paymentMethod === 'pix' ? 'Gerar PIX' :
                         paymentMethod === 'card' ? 'Pagar' :
                         'Continuar'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClienteAgendar;
