import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BackArrow } from "@/components/ui/back-arrow";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Clock, Check, Tag, CreditCard, Landmark, Loader2, Calendar as CalendarIcon, Shield, Zap, Star, Store, ChevronRight, Crown, Wallet, MapPin, X } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";
import pixIcon from "@/assets/pix-icon.png";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { format, eachDayOfInterval, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getServiceFee } from "@/lib/payment-fees";
import { formatCPF, validateCPF } from "@/lib/validators";
import {
  getBookingContext,
  setBookingContext,
  getCachedBookingData,
  fetchBarbers,
  fetchServices,
  fetchUnits,
} from "@/lib/bookingPrefetch";

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
import { useBlockedBarbers } from "@/hooks/useBlockedBarbers";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { useBarberPaymentOptions } from "@/hooks/useBarberPaymentOptions";
import { resolveBookingPaymentMethod, type BookingPaymentMethod } from "@/lib/barber-payment-options";
import { PendingSubscriptionDrawer } from "@/components/client/PendingSubscriptionDrawer";
import { usePendingSubscription } from "@/hooks/usePendingSubscription";
import { useCancelSubscriptionMutation } from "@/hooks/useClientMutations";



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
  servicos: Service[]; // Adicionado: lista de serviços permitidos pelo plano
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

  // ── Hidratação SÍNCRONA do cache: a lista de profissionais aparece na hora ──
  const bootRef = useRef<{
    ctx: ReturnType<typeof getBookingContext>;
    cached: ReturnType<typeof getCachedBookingData> | null;
  }>(null as any);
  if (!bootRef.current) {
    const ctx = getBookingContext();
    bootRef.current = {
      ctx,
      cached: ctx ? getCachedBookingData(ctx.tenantId, ctx.unitId) : null,
    };
  }
  const boot = bootRef.current;
  const hasInstantBarbers = Boolean(boot.cached?.barbers?.length) && !boot.ctx?.hasPlan;

  const [barbers, setBarbers] = useState<Barber[]>((boot.cached?.barbers as Barber[]) ?? []);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [services, setServices] = useState<Service[]>((boot.cached?.services as Service[]) ?? []);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod | null>('cash');
  

  const [walletBalance, setWalletBalance] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingDrawerOpen, setPendingDrawerOpen] = useState(false);
  const hasAutoOpenedPendingRef = useRef<string | null>(null);
  const { cancelSubscription, cancelling: isCancelingSubscription } = useCancelSubscriptionMutation();
  const [hasAutoOpenedThisSession, setHasAutoOpenedThisSession] = useState(false);

  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);

  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
  const servicesListRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [subscriptionLimitReached, setSubscriptionLimitReached] = useState(false);
  const [availableRedemptions, setAvailableRedemptions] = useState<{ id: string; promocao_id: string }[]>([]);
  const [hasActiveRedemptionAppointment, setHasActiveRedemptionAppointment] = useState(false);
  const [useRedemption, setUseRedemption] = useState(false);
  const [referralCredits, setReferralCredits] = useState(0);
  const [useReferralCredit, setUseReferralCredit] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [showLoseRedemptionDialog, setShowLoseRedemptionDialog] = useState(false);
  const [consumingRedemption, setConsumingRedemption] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'cash' | 'pix' | 'wallet' | null>(null);
  const [loseDialogContext, setLoseDialogContext] = useState<'toggle' | 'switch' | 'continue'>('continue');
  const redemptionAutoSelectedRef = useRef(false);
  const loseWarningShownRef = useRef(false);
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  
  // Durações personalizadas do barbeiro selecionado (servico_id → duracao)
  const [barberCustomDurations, setBarberCustomDurations] = useState<Record<string, number>>({});
  
  // Dias fechados no calendário (barbearia/barbeiro não trabalha)
  const [closedDates, setClosedDates] = useState<Date[]>([]);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);
  const [closedDatesLoading, setClosedDatesLoading] = useState(false);
  
  // Estados para cupom de desconto (sistema novo: tabela `cupons` + RPCs)
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    tipo_desconto: "percentual" | "fixo";
    valor_desconto: number;
    valor_descontado: number; // já calculado pelo RPC sobre o valor base atual
    obrigatorio?: boolean;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [pendingMandatoryCoupon, setPendingMandatoryCoupon] = useState<{
    id: string;
    code: string;
  } | null>(null);
  
  // Indica se o usuário está usando fluxo de plano (serviço pré-selecionado)
  const [isPlanFlow, setIsPlanFlow] = useState(false);
  const [isInitializing, setIsInitializing] = useState(!hasInstantBarbers);

  // Barbearia preferida do usuário (multi-tenant)
  const [preferredShop, setPreferredShop] = useState<{ id: string; nome: string } | null>(null);
  const [showingOtherShops, setShowingOtherShops] = useState(false);
  const [allBarbers, setAllBarbers] = useState<Barber[]>((boot.cached?.allBarbers as Barber[]) ?? []);

  // Sistema de unidades
  const [tenantUnits, setTenantUnits] = useState<TenantUnit[]>((boot.cached?.units as TenantUnit[]) ?? []);
  const [selectedUnit, setSelectedUnit] = useState<TenantUnit | null>(null);
  const [preferredUnitId, setPreferredUnitId] = useState<string | null>(boot.ctx?.unitId ?? null);
  const [hasMultipleUnits, setHasMultipleUnits] = useState((boot.cached?.units?.length ?? 0) > 1);

  // Verificação se usuário pode usar o plano
  const isPlanEligible =
    !isRescheduling &&
    isPlanFlow &&
    activeSubscription &&
    (selectedServices?.length ?? 0) === 1 &&
    // O serviço selecionado deve estar na lista de serviços do plano
    activeSubscription.servicos.some(s => s.id === selectedServices?.[0]?.id) &&
    activeSubscription.agendamentos_usados < activeSubscription.limite_agendamentos_mes;


  // Barbeiros bloqueados para este cliente
  const { blockedIds: blockedBarberIds } = useBlockedBarbers();

  const { data: pendingSubscription, refetch: refetchPending } = usePendingSubscription(userId);

  // Auto-show pending subscription drawer
  useEffect(() => {
    if (pendingSubscription && !hasAutoOpenedThisSession && hasAutoOpenedPendingRef.current !== (pendingSubscription as any).id) {
      hasAutoOpenedPendingRef.current = (pendingSubscription as any).id;
      setHasAutoOpenedThisSession(true);
      setPendingDrawerOpen(true);
    }
  }, [pendingSubscription, hasAutoOpenedThisSession]);

  const handleCancelSubscription = async () => {
    cancelSubscription(() => {
      setPendingDrawerOpen(false);
      refetchPending();
    });
  };


  // Avaliações dos barbeiros
  const { ratings: barberRatings } = useBarberRatings(barbers.map(b => b.id));

  /** Retorna a duração efetiva de um serviço (personalizada do barbeiro ou padrão) */
  const getEffectiveDuration = useCallback((service: Service) => {
    return barberCustomDurations[service.id] ?? service.duracao_minutos;
  }, [barberCustomDurations]);

  const totalDuration = (selectedServices || []).reduce((sum, s) => sum + getEffectiveDuration(s) * (serviceQuantities[s.id] || 1), 0);

  /**
   * Clientes que sempre agendam acompanhado (dupla) dentro do plano.
   * O agendamento é criado com quantidade fixa, dobrando duração e reservando
   * o tempo correto na agenda do barbeiro — igual a selecionar 2x o serviço.
   */
  const COMPANION_PLAN_USERS: Record<string, number> = {
    "d1de638f-a01d-45d0-87ee-fcd5bfa00c99": 2, // Tiago da Silva (corta sempre com o irmão)
  };
  const companionQuantity = userId ? COMPANION_PLAN_USERS[userId] : undefined;
  const isCompanionPlanUser = isPlanFlow && !!companionQuantity;

  // Força a quantidade fixa nos serviços do plano para esses clientes
  useEffect(() => {
    if (!isCompanionPlanUser || !companionQuantity || selectedServices.length === 0) return;
    setServiceQuantities(prev => {
      let changed = false;
      const next = { ...prev };
      for (const s of selectedServices) {
        if (next[s.id] !== companionQuantity) {
          next[s.id] = companionQuantity;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [isCompanionPlanUser, companionQuantity, selectedServices]);

  // Fonte única do barbeiro selecionado (fallback para assinatura vinculada)
  const selectedBarberId = selectedBarber?.id || activeSubscription?.barbeiro_id || null;
  const paymentTenantId = selectedBarber?.tenant_id ?? activeSubscription?.barbeiro?.tenant_id ?? preferredShop?.id ?? null;
  const { pixHabilitado, barbeariaHabilitado, loading: paymentOptionsLoading, error: paymentOptionsError } =
    useBarberPaymentOptions(selectedBarberId, paymentTenantId);

  // Status da carteira do barbeiro (legado Efí): define se podemos oferecer Carteira do app
  const { canReceivePix: canReceivePixWallet } = useWalletStatus(selectedBarberId);

  // Woovi: verifica se o barbeiro selecionado tem chave Pix Woovi cadastrada
  const [barberWooviKey, setBarberWooviKey] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedBarberId) { setBarberWooviKey(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('barbeiros')
        .select('woovi_pix_key')
        .eq('id', selectedBarberId)
        .maybeSingle();
      if (!cancelled) setBarberWooviKey((data?.woovi_pix_key as string | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [selectedBarberId]);

  // PIX disponível se o barbeiro tem chave Woovi (novo) ou carteira Efí ativa (legado)
  const canReceivePix = !!barberWooviKey || canReceivePixWallet;

  const availabilityTenantId = selectedBarber?.tenant_id ?? (preferredShop?.id ?? null);

  const { 
    slots: availableSlots, 
    loading: loadingSlots, 
    hasLoaded: slotsHasLoaded,
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
    const { filtered, all } = await fetchBarbers(tenantId ?? null, unitId ?? null);
    const filterBlocked = (list: Barber[]) => list.filter(b => !blockedBarberIds.includes(b.id));
    setBarbers(filterBlocked(filtered as Barber[]));
    setAllBarbers(filterBlocked(all as Barber[]));
    return filtered as Barber[];
  };

  // Carregar unidades do tenant
  const loadTenantUnits = async (tenantId: string) => {
    const units = (await fetchUnits(tenantId)) as TenantUnit[];
    setTenantUnits(units);
    setHasMultipleUnits(units.length > 1);
    return units;
  };


  // Initialize booking
  useEffect(() => {
    const initializeBooking = async () => {
      try {
        // Flags locais (síncronas) — decididas antes de qualquer rede
        const resumePaymentRaw = sessionStorage.getItem("resumeToPaymentStep");
        const isReschedulingSession = sessionStorage.getItem("isRescheduling");
        const appointmentId = sessionStorage.getItem("rescheduleAppointmentId");
        const barberFromParam = searchParams.get("barber");

        const cachedCtx = boot.ctx;
        const isPlainFlow = !resumePaymentRaw && isReschedulingSession !== "true";

        // ── Revalidação otimista: com cache quente já pintamos a tela e
        //    atualizamos os dados do último contexto conhecido em paralelo ──
        let optimistic: Promise<Barber[] | null> | null = null;
        if (hasInstantBarbers && cachedCtx && isPlainFlow) {
          if (cachedCtx.unitId && boot.cached?.units) {
            const cachedUnit = boot.cached.units.find((u) => u.id === cachedCtx.unitId);
            if (cachedUnit) setSelectedUnit(cachedUnit as TenantUnit);
          }
          optimistic = Promise.all([
            loadBarbers(cachedCtx.tenantId, cachedCtx.unitId),
            loadServices(cachedCtx.tenantId),
          ])
            .then(([list]) => list as Barber[])
            .catch(() => null);
        }

        // SINGLE session call — reused everywhere (leitura local, sem rede)
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id || null;
        if (uid) setUserId(uid);

        // Rescheduling — early exit, minimal queries
        if (isReschedulingSession === "true" && appointmentId) {
          setIsRescheduling(true);
          setRescheduleAppointmentId(appointmentId);
          loadAppointmentForReschedule(appointmentId);
          setIsInitializing(false);
          return;
        }

        const profilePromise = uid
          ? supabase
              .from("profiles")
              .select("barbearia_preferida_id, unidade_preferida_id, cpf")
              .eq("id", uid)
              .single()
          : Promise.resolve({ data: null, error: null });

        const [{ data: profile }, subscription] = await Promise.all([
          profilePromise,
          !resumePaymentRaw ? loadActiveSubscriptionOptimized(uid) : Promise.resolve(null),
        ]);

        // Carregar barbearia preferida + unidade preferida do perfil
        let tenantId: string | null = null;
        let userPreferredUnitId: string | null = null;

        const savedCpf = ((profile as any)?.cpf || "").replace(/\D/g, "");
        if (savedCpf) {
          setProfileCpf(savedCpf);
          setCpfInput(formatCPF(savedCpf));
        } else {
          setProfileCpf(null);
        }

        if (profile?.barbearia_preferida_id) {
          tenantId = profile.barbearia_preferida_id;
          userPreferredUnitId = (profile as any).unidade_preferida_id || null;
          setPreferredUnitId(userPreferredUnitId);

          // Buscar nome da barbearia (non-blocking)
          supabase
            .from("tenants")
            .select("id, nome")
            .eq("id", tenantId)
            .single()
            .then(({ data: tenant }) => {
              if (tenant) setPreferredShop(tenant);
            });
        }

        // Dados secundários (créditos, resgates, carteira) nunca bloqueiam a tela
        void loadUserCreditsOptimized(uid);
        void loadAvailableRedemptionsOptimized(uid);

        // ══════════════════════════════════════════════════════════════
        // FAST-PATH: plano ativo pula as consultas pesadas
        // ══════════════════════════════════════════════════════════════
        if (!resumePaymentRaw) {
          if (subscription) {
            setBookingContext({ tenantId, unitId: null, hasPlan: true });
            const restantes = subscription.limite_agendamentos_mes - subscription.agendamentos_usados;

            if (restantes > 0) {
              if (subscription.barbeiro) {
                setSelectedBarber(subscription.barbeiro);
                void loadBarberCustomDurations(subscription.barbeiro.id);
              }

              if (subscription.servicos.length === 0) {
                setSubscriptionBlocked(true);
                toast.error("Seu plano não possui um serviço válido vinculado. Fale com o suporte da barbearia.");
                setIsInitializing(false);
                return;
              }

              setIsPlanFlow(true);

              if (subscription.servicos.length === 1 && subscription.barbeiro) {
                setSelectedServices([subscription.servicos[0]]);
                setStep(3);
              } else if (subscription.servicos.length > 1 && subscription.barbeiro) {
                setStep(2);
              } else {
                setStep(1);
                setIsInitializing(false);
                await loadBarbers(tenantId, null);
              }
              setIsInitializing(false);
              return;
            }

            setSubscriptionLimitReached(true);
            setIsInitializing(false);
            return;
          }
        }

        // ══════════════════════════════════════════════════════════════
        // NORMAL PATH
        // ══════════════════════════════════════════════════════════════
        let effectiveUnitId: string | null = null;

        if (tenantId) {
          const units = boot.cached?.units?.length && cachedCtx?.tenantId === tenantId
            ? ((boot.cached.units as TenantUnit[]))
            : await loadTenantUnits(tenantId);

          // revalida unidades em background quando veio do cache
          if (boot.cached?.units?.length && cachedCtx?.tenantId === tenantId) {
            void loadTenantUnits(tenantId);
          }

          const preferredUnit = userPreferredUnitId
            ? units.find((u) => u.id === userPreferredUnitId)
            : undefined;
          if (preferredUnit) {
            setSelectedUnit(preferredUnit);
            effectiveUnitId = preferredUnit.id;
          }
        }

        // Salva contexto para o próximo boot instantâneo
        setBookingContext({ tenantId, unitId: effectiveUnitId, hasPlan: false });

        const sameAsCached =
          optimistic !== null &&
          cachedCtx?.tenantId === tenantId &&
          (cachedCtx?.unitId ?? null) === effectiveUnitId;

        let barbersList: Barber[];
        if (sameAsCached && optimistic) {
          setIsInitializing(false);
          barbersList = (await optimistic) ?? ((boot.cached?.barbers as Barber[]) ?? []);
        } else {
          barbersList = await loadBarbers(tenantId, effectiveUnitId);
          setIsInitializing(false);
          void loadServices(tenantId);
        }

        // Auto-select barber from query param
        if (barberFromParam && barbersList?.length) {
          const matchedBarber = barbersList.find((b: Barber) => b.id === barberFromParam);
          if (matchedBarber) {
            setSelectedBarber(matchedBarber);
            loadBarberCustomDurations(matchedBarber.id);
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

        setStep(1);
        setIsInitializing(false);
      } catch (err) {
        console.error("[initializeBooking] Fatal error:", err);
        setIsInitializing(false);
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
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
            setBookingSuccess(true);
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
    const allServices = await fetchServices(tenantId ?? null);
    let finalServices = (allServices || []) as unknown as Service[];

    // Se cliente tem plano ativo e está em fluxo de plano, restringir aos serviços vinculados
    if (isPlanFlow && activeSubscription?.servicos && activeSubscription.servicos.length > 0) {
      const permittedIds = activeSubscription.servicos.map(s => s.id);
      finalServices = finalServices.filter((s) => permittedIds.includes(s.id));
    }


    setServices(finalServices);
    return finalServices;
  };

  const loadUserCreditsOptimized = async (uid: string | null) => {
    if (!uid) return;
    try {
      // Parallel: credits RPC + wallet edge function (sem refreshSession bloqueante)
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
      // Regra anti-burla: se já existe agendamento ativo usando Corte Grátis,
      // não mostrar outro resgate disponível até esse agendamento ser cancelado.
      const [activeRes, redemptionsRes] = await Promise.all([
        (supabase as any).rpc("user_has_active_redemption_appointment", {
          p_user_id: uid,
          p_exclude_appointment_id: null,
        }),
        supabase
          .from("resgates")
          .select("id, promocao_id")
          .eq("user_id", uid)
          .eq("status", "available")
          .is("used_at", null)
          .order("created_at", { ascending: true }),
      ]);

      const hasActiveFreeAppointment = Boolean(activeRes.data);
      setHasActiveRedemptionAppointment(hasActiveFreeAppointment);

      if (hasActiveFreeAppointment) {
        setAvailableRedemptions([]);
        setUseRedemption(false);
        redemptionAutoSelectedRef.current = false;
        return;
      }
      setAvailableRedemptions(redemptionsRes.data || []);

      // Buscar créditos de indicação disponíveis (paralelo simples)
      const { count: refCount } = await supabase
        .from("creditos_indicacao")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("status", "disponivel");
      setReferralCredits(refCount || 0);
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
          ciclo_inicio,
          ciclo_fim,
          status,
          usos_ciclo_atual,
          barbeiro_id,
          barbeiro:barbeiros(id, apelido, foto_url, tenant_id),
          plano:planos(
            *,
            plano_servicos(servico_id, servicos:servicos(*))
          )
        `)

        .eq("user_id", uid)
        .eq("status", "active")
        // Várias assinaturas "active" podem coexistir (renovações antigas):
        // prioriza a de vencimento mais distante, evitando pegar um ciclo já vencido.
        .order("next_billing_date", { ascending: false, nullsFirst: false })
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
      const joinedService = Array.isArray(planoData?.servico)
        ? planoData.servico[0] ?? null
        : planoData?.servico ?? null;
      const joinedBarber = Array.isArray((subscription as any).barbeiro)
        ? (subscription as any).barbeiro[0] ?? null
        : (subscription as any).barbeiro ?? null;

      const cycleStartDate = subscription.ciclo_inicio
        ? subscription.ciclo_inicio
        : (() => {
            const cycleStart = new Date(`${subscription.next_billing_date}T12:00:00`);
            cycleStart.setMonth(cycleStart.getMonth() - 1);
            return cycleStart.toISOString().split('T')[0];
          })();
      const cycleEndDate = subscription.ciclo_fim || subscription.next_billing_date;

      // Fonte de verdade do consumo: mesma regra do banco/trigger
      const [usageRes, servicoRes, barbeiroRes] = await Promise.all([
        supabase.rpc('count_subscription_uses_in_cycle', {
          p_assinatura_id: subscription.id,
          p_cycle_start: cycleStartDate,
          p_cycle_end: cycleEndDate,
        }),
        joinedService || !planoData.servico_id
          ? Promise.resolve({ data: joinedService })
          : supabase.from("servicos").select("id, nome, descricao, duracao_minutos, preco").eq("id", planoData.servico_id).single(),
        joinedBarber || !subscription.barbeiro_id
          ? Promise.resolve({ data: joinedBarber })
          : supabase.from("barbeiros").select("id, apelido, foto_url, tenant_id").eq("id", subscription.barbeiro_id).single(),
      ]);

      const rpcUsedCount = usageRes.error ? 0 : Number(usageRes.data || 0);
      const usedCount = Math.max(Number((subscription as any).usos_ciclo_atual || 0), rpcUsedCount);

      // Extrair serviços da tabela associativa
      let servicosDoPlano: Service[] = (planoData?.plano_servicos || [])
        .map((v: any) => v.servicos)
        .filter(Boolean);

      // Fallback para servico_id legado se a tabela associativa estiver vazia
      if (servicosDoPlano.length === 0 && planoData?.servico_id) {
        const { data: legacyService } = await supabase
          .from("servicos")
          .select("id, nome, descricao, duracao_minutos, preco")
          .eq("id", planoData.servico_id)
          .maybeSingle();
        if (legacyService) servicosDoPlano = [legacyService as Service];
      }

      const activeSubscriptionData: ActiveSubscription = {
        id: subscription.id,
        plano_id: subscription.plano_id,
        plano_nome: planoData.nome,
        limite_agendamentos_mes: planoData.limite_agendamentos_mes,
        agendamentos_usados: usedCount,
        next_billing_date: subscription.next_billing_date,
        status: subscription.status,
        servico_id: planoData.servico_id || null,
        servico: servicosDoPlano[0] || null,
        servicos: servicosDoPlano,
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

      // Parallelizar TODAS as queries: SEMPRE buscar config global + (config barbeiro) + exceções.
      // Config do barbeiro tem prioridade dia-a-dia, mas dias não configurados pelo barbeiro
      // usam o global (assim domingo fechado no global é respeitado mesmo sem linha do barbeiro).
      const tenantId = selectedBarber?.tenant_id ?? preferredShop?.id ?? null;
      let globalExceptionQuery = supabase
        .from('horarios_excepcionais')
        .select('data, aberto')
        .gte('data', startStr)
        .lte('data', endStr);
      if (tenantId) globalExceptionQuery = globalExceptionQuery.eq('tenant_id', tenantId);

      const [globalConfigResult, barberConfigResult, globalExcResult, barberExcResult] = await Promise.all([
        supabase.from('configuracoes_horario').select('dia_semana, aberto'),
        barbeiroId
          ? supabase.from('configuracoes_horario_barbeiro').select('dia_semana, aberto').eq('barbeiro_id', barbeiroId)
          : Promise.resolve({ data: null as { dia_semana: number; aberto: boolean }[] | null }),
        globalExceptionQuery,
        barbeiroId
          ? supabase.from('horarios_excepcionais_barbeiro').select('data, aberto').eq('barbeiro_id', barbeiroId).gte('data', startStr).lte('data', endStr)
          : Promise.resolve({ data: null as { data: string; aberto: boolean }[] | null }),
      ]);

      // Construir mapa weekday → aberto começando pelo global e sobrescrevendo com o do barbeiro
      const weekdayOpenMap: Record<number, boolean> = {};
      for (const c of globalConfigResult.data || []) {
        weekdayOpenMap[c.dia_semana] = c.aberto !== false;
      }
      for (const c of (barberConfigResult.data || [])) {
        weekdayOpenMap[c.dia_semana] = c.aberto !== false;
      }
      const weeklyClosedDays: number[] = Object.entries(weekdayOpenMap)
        .filter(([, open]) => !open)
        .map(([dow]) => Number(dow));

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

      setClosedWeekdays(weeklyClosedDays);
      setClosedDates(closed);
    } catch (error) {
      console.error('[loadClosedDates] Erro:', error);
    } finally {
      setClosedDatesLoading(false);
    }
  }, [selectedBarber?.tenant_id, selectedBarberId, preferredShop?.id]);

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
      const safeBarbers = (nextBarbers || []).filter(b => !blockedBarberIds.includes(b.id));

      setServices(safeServices);
      setBarbers(safeBarbers);
      // Para fluxo de plano, NÃO remover o serviço pré-selecionado do plano
      if (!isPlanFlow) {
        setSelectedServices((prev) => prev.filter((service) => safeServices.some((item) => item.id === service.id)));
      }

      if (selectedBarberId) {
        const refreshedBarber = safeBarbers.find((barber) => barber.id === selectedBarberId);
        if (refreshedBarber) {
          setSelectedBarber(refreshedBarber);
        } else {
          console.warn('[syncBookingData] Profissional selecionado não apareceu na atualização; mantendo seleção atual.');
        }
      }

      const baseDate = selectedDate || new Date();
      const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      await loadClosedDates(monthStart, monthEnd);
    } catch (error) {
      console.error("[syncBookingData] Erro ao sincronizar dados:", error);
    }
  }, [selectedBarber?.tenant_id, preferredShop?.id, selectedBarberId, selectedDate, isPlanFlow, loadClosedDates]);


  // ─── Cupom pendente / obrigatório para este cliente neste tenant ───
  useEffect(() => {
    if (!userId) return;
    const tenantId = selectedBarber?.tenant_id ?? preferredShop?.id ?? null;
    if (!tenantId) return;
    // Não sobrescrever um cupom já aplicado manualmente
    if (appliedCoupon) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_cupom_pendente_obrigatorio", {
          p_tenant_id: tenantId,
          p_user_id: userId,
        });
        if (cancelled || error) return;
        const row = Array.isArray(data) ? data[0] : (data as any);
        if (!row) {
          setPendingMandatoryCoupon(null);
          return;
        }

        if (row.uso_obrigatorio) {
          setPendingMandatoryCoupon({ id: row.id, code: row.codigo });
        }

        if (row.auto_aplicar) {
          // Aplica em background usando o valor base atual (pode ser 0 se ainda sem serviço)
          await validateCoupon(row.codigo, { silent: false });
          // Marca como obrigatório se for o caso
          if (row.uso_obrigatorio) {
            setAppliedCoupon((prev) => (prev ? { ...prev, obrigatorio: true } : prev));
          }
        }
      } catch (err) {
        console.error("Erro ao buscar cupom pendente:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedBarber?.tenant_id, preferredShop?.id]);

  // ─── Pré-aplicação de cupom vindo de "Usar agora" (Meus Cupons) ───
  useEffect(() => {
    if (!userId) return;
    if (appliedCoupon) return;
    const code = sessionStorage.getItem("preApplyCoupon");
    if (!code) return;
    const tenantId = selectedBarber?.tenant_id ?? preferredShop?.id ?? null;
    if (!tenantId) return;
    sessionStorage.removeItem("preApplyCoupon");
    setCouponCode(code);
    validateCoupon(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedBarber?.tenant_id, preferredShop?.id]);

  // ─── Canal Realtime: Assinatura do usuário (sync em tempo real) ───
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`assinatura-agendar-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assinaturas',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          const newStatus = newRow?.status;
          const oldStatus = oldRow?.status;

          // Sempre recarrega a assinatura ativa (fonte de verdade)
          const sub = await loadActiveSubscriptionOptimized(userId);

          if (sub && newStatus === 'active') {
            // Plano ficou ativo durante a sessão → entra no modo plano automaticamente
            setSubscriptionBlocked(false);
            setSubscriptionLimitReached(false);

            if (payload.eventType === 'INSERT' || (oldStatus && oldStatus !== 'active')) {
              const barberName = sub.barbeiro?.apelido;
              toast.success(
                barberName
                  ? `🎉 Plano ativo com ${barberName}! Pronto para agendar.`
                  : '🎉 Seu plano foi ativado!'
              );
            }
          } else if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
            toast.error('Seu plano foi cancelado');
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
      
      // Se tem resgate disponível, SEMPRE passa pelo passo 5 (Pagamento)
      // para que o cliente veja as opções e o aviso de perda de promoção se não usar.
      if (canUseRedemption) {
        setStep(5);
        return;
      }

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

    // Bloqueio: cupom obrigatório pendente e ainda não aplicado
    if (pendingMandatoryCoupon && (!appliedCoupon || appliedCoupon.id !== pendingMandatoryCoupon.id)) {
      toast.error(`Você tem um cupom pendente: ${pendingMandatoryCoupon.code}`);
      return;
    }

    if (isPlanEligible) {
      await createAppointmentWithPlan();
      return;
    }

    const totalPrice = getTotalPrice();
    const finalPrice = Math.max(0, totalPrice - availableCredits);
    const serviceFee = getServiceFee(paymentMethod);
    const chargeAmount = finalPrice + serviceFee;

    if (useReferralCredit && referralCredits > 0) {
      await createAppointmentWithReferralCredit();
      return;
    }

    if (totalPrice === 0 && useRedemption) {
      await createAppointmentWithRedemption();
      return;
    }

    if (finalPrice === 0) {
      await createAppointmentWithCredits(totalPrice);
      return;
    }

    if (paymentOptionsLoading || paymentOptionsError || !paymentMethod || !availablePaymentMethods[paymentMethod]) {
      toast.error("Escolha uma forma de pagamento disponível para este profissional.");
      setStep(5);
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
      const mainService = getCorteService() || selectedServices[0];
      
      // Construir observações detalhadas para o webhook/notificação
      let finalObservacoes = selectedServices.length > 1 
        ? `Serviços: ${serviceNames}` 
        : "";
        
      if (useRedemption) {
        finalObservacoes = finalObservacoes 
          ? `${finalObservacoes} (Inclui Corte Grátis)`
          : "Resgate de Corte Grátis";
      }
      
      if (availableCredits > 0) {
        const creditsApplied = Math.min(availableCredits, totalPrice);
        if (creditsApplied > 0) {
          const creditMsg = `Créditos aplicados: R$ ${creditsApplied.toFixed(2)}`;
          finalObservacoes = finalObservacoes 
            ? `${finalObservacoes} | ${creditMsg}`
            : creditMsg;
        }
      }





      const bookingData = {
        servico_id: mainService.id,
        barbeiro_id: selectedBarberId || null,
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora: bookingTime,
        duracao: totalDuration,
        preco: finalPrice,
        serviceName: serviceNames,
        observacoes: finalObservacoes || undefined,
        unidade_id: selectedUnit?.id || null,
      };

      // === Cartão via Asaas Checkout ===
      if (paymentMethod === 'card') {
        const { data, error } = await supabase.functions.invoke('create-asaas-card', {
          body: {
            bookingData: { ...bookingData, preco: chargeAmount },
            serviceFee,
            rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
            consumeRedemptionOnPaidBooking: canUseRedemption && !useRedemption && availableRedemptions.length > 0,
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

      // === PIX automático ===
      if (paymentMethod === 'pix') {
        const useWoovi = !!barberWooviKey;
        const fnName = useWoovi ? 'woovi-create-charge' : 'efi-create-pix-charge';
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: {
            barbeiro_id: bookingData.barbeiro_id,
            valor: chargeAmount,
            descricao: `Agendamento - ${serviceNames}`,
            servico_id: bookingData.servico_id,
            data: bookingData.data,
            hora: bookingData.hora,
            duracao: bookingData.duracao,
            observacoes: bookingData.observacoes,
            consumeRedemptionOnPaidBooking: canUseRedemption && !useRedemption && availableRedemptions.length > 0,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        sessionStorage.setItem('pix_checkout_data', JSON.stringify({
          pixQrCode: data.qr_code_image?.replace(/^data:image\/png;base64,/, '') ?? '',
          pixPayload: data.br_code,
          pendingBookingId: data.pending_booking_id,
          asaasPaymentId: data.charge_id ?? data.txid,
          provider: useWoovi ? 'woovi' : 'efi',
          txid: data.txid,
          correlationId: data.correlation_id,
          chargeId: data.charge_id,
          expiresAt: data.expires_at,
          value: chargeAmount,
          serviceFee,
          serviceName: serviceNames,
          barberName: barbers.find(b => b.id === selectedBarberId)?.apelido,
          bookingDate: format(selectedDate, "dd/MM/yyyy"),
          bookingTime: bookingTime,
        }));
        navigate('/cliente/pix-checkout');
        return;
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
          consumeRedemptionOnPaidBooking: canUseRedemption && !useRedemption && availableRedemptions.length > 0,
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

        if (useRedemption && data.appointmentId) {
          setAvailableRedemptions([]);
          setUseRedemption(false);
      } else if (canUseRedemption && availableRedemptions.length > 0) {
          await consumeRedemptionsAsLost(data.appointmentId);
        }

        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');

        if (remainderCash > 0) {
          toast.success(`R$ ${walletDebit.toFixed(2)} debitado da carteira. Pague R$ ${remainderCash.toFixed(2)} na barbearia.`);
        } else {
          toast.success("Agendamento criado! Pagamento debitado da carteira.");
        }
        setBookingSuccess(true);
        return;
      }

      // === Pagamento na Barbearia (cash) ===
      const payload: any = {
        bookingData,
        metodo: 'cash',
        creditsUsed: Math.min(availableCredits, totalPrice),
        rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
        consumeRedemptionOnPaidBooking: canUseRedemption && !useRedemption && availableRedemptions.length > 0,
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
      } else if (canUseRedemption && availableRedemptions.length > 0) {
        await consumeRedemptionsAsLost(data.appointmentId);
      }

      if (appliedCoupon && data.appointmentId) {
        await registerCouponUsage(data.appointmentId);
      }

      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');
      
      // Webhook de confirmação é enviado automaticamente pelo trigger do banco de dados
      
      toast.success("Agendamento criado! Pague na barbearia.");
      setBookingSuccess(true);
    } catch (error: any) {
      console.error('Payment error:', error);

      // Extrai mensagem real do corpo de resposta da edge function (FunctionsHttpError)
      let errorMessage = error?.message || "";
      let errorCode = "";
      try {
        if (error?.context && typeof error.context.json === 'function') {
          const body = await error.context.json();
          if (body?.error) errorMessage = body.error;
          if (body?.code) errorCode = body.code;
        } else if (error?.context && typeof error.context.text === 'function') {
          const text = await error.context.text();
          try {
            const body = JSON.parse(text);
            if (body?.error) errorMessage = body.error;
            if (body?.code) errorCode = body.code;
          } catch {}
        }
      } catch {}

      if (
        errorCode === 'TIME_SLOT_UNAVAILABLE' ||
        errorMessage.includes('indisponível') ||
        errorMessage.includes('Horário') ||
        errorMessage.includes('expediente')
      ) {
        toast.error(errorMessage || "Horário indisponível. Escolha outro horário.");
        setStep(4);
        refreshSlots();
      } else {
        const paymentUnavailable = errorCode === 'WOOVI_AUTH_INVALID' || errorCode === 'WOOVI_AUTH_MISSING';
        toast.error(
          paymentUnavailable
            ? "Pagamento PIX temporariamente indisponível. Escolha outra forma de pagamento."
            : "Erro ao processar pagamento: " + (errorMessage || "Erro desconhecido"),
        );
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
      const mainService = useRedemption ? (getCorteService() || selectedServices[0]) : selectedServices[0];
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
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          unidade_id: selectedUnit?.id || null,
        } as any)
        .select()
        .single();

      if (aptError) throw aptError;

      await markRedemptionAsUsed(appointment.id);

      setHasActiveRedemptionAppointment(true);
      setAvailableRedemptions([]);
      setUseRedemption(false);

      // Webhook de confirmação é enviado automaticamente pelo trigger do banco de dados

      toast.success("Corte grátis resgatado com sucesso!");
      setBookingSuccess(true);
    } catch (error: any) {
      console.error('Error creating appointment with redemption:', error);
      toast.error("Erro ao criar agendamento: " + (error.message || "Erro desconhecido"));
    } finally {
      setProcessingPayment(false);
    }
  };

  /** Cria agendamento gratuito consumindo um crédito de indicação */
  const createAppointmentWithReferralCredit = async () => {
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
      const mainService = getCorteService() || selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');
      const bookingTime = normalizeTimeValue(selectedTime);

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
          userId: session.user.id,
          barberId: selectedBarberId,
        },
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
          observacoes: `Corte grátis por indicação. ${selectedServices.length > 1 ? 'Serviços: ' + serviceNames : ''}`,
          payment_method: 'indicacao',
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          unidade_id: selectedUnit?.id || null,
        } as any)
        .select()
        .single();

      if (aptError) throw aptError;

      // Consome o crédito de indicação após o agendamento ser criado
      const { data: consumed, error: consumeError } = await (supabase as any).rpc(
        "consumir_credito_indicacao",
        { p_agendamento_id: appointment.id }
      );

      if (consumeError || consumed === false) {
        // Race condition: crédito não estava mais disponível.
        // Reverte o agendamento e avisa o cliente.
        await supabase
          .from("agendamentos")
          .update({ status: 'cancelled_by_user' as any, visivel_para_usuario: false } as any)
          .eq("id", appointment.id);

        setReferralCredits(0);
        setUseReferralCredit(false);
        toast.error("Seu crédito de indicação não está mais disponível. Escolha outra forma de pagamento.");
        return;
      }

      setReferralCredits((prev) => Math.max(0, prev - 1));
      setUseReferralCredit(false);

      toast.success("Corte grátis de indicação resgatado com sucesso!");
      setBookingSuccess(true);
    } catch (error: any) {
      console.error('Error creating appointment with referral credit:', error);
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
      const mainService = useRedemption ? (getCorteService() || selectedServices[0]) : selectedServices[0];
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
      const observacoesText = [
        selectedServices.length > 1 ? `Serviços: ${serviceNames}` : null,
        useRedemption ? "Inclui Corte Grátis" : null,
        `Pago com crédito do app: R$ ${creditUsedAmount.toFixed(2)}`,
      ].filter(Boolean).join(". ");

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
      } else if (canUseRedemption && availableRedemptions.length > 0) {
        await consumeRedemptionsAsLost(appointment.id);
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
          observacoes: `Agendamento via ${activeSubscription.plano_nome}.${isCompanionPlanUser ? ` ${companionQuantity} pessoas — ${serviceNames}.` : ''} ${selectedServices.length > 1 ? 'Serviços: ' + serviceNames : ''}`.trim(),
          payment_method: 'plano',
          tipo_agendamento: 'plano',
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
      setBookingSuccess(true);
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
    
    setConsumingRedemption(true);
    // Usar o mesmo critério do trigger (mais antigo primeiro)
    const redemptionToUse = availableRedemptions[0];
    
    try {
      const resolvedUserId = userId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!resolvedUserId) throw new Error("Usuário não autenticado");

      const { error } = await (supabase as any).rpc("mark_available_redemption_as_used", {
        p_user_id: resolvedUserId,
        p_appointment_id: appointmentId,
        p_reason: "free_haircut_used_from_booking_flow",
      });

      if (error) throw error;

      setAvailableRedemptions(prev => prev.filter(r => r.id !== redemptionToUse.id));
      setUseRedemption(false);
    } catch (err) {
      console.error("Erro ao marcar resgate como usado:", err);
      // Não bloqueia o fluxo se o agendamento já foi criado
      toast.error("Houve um pequeno erro ao validar seu corte grátis, mas seu agendamento está garantido!");
    } finally {
      setConsumingRedemption(false);
    }
  };

  /** Resolve o tenant_id alvo para o agendamento atual */
  const getCouponTenantId = useCallback((): string | null => {
    return selectedBarber?.tenant_id ?? preferredShop?.id ?? null;
  }, [selectedBarber, preferredShop]);

  /** Valor base para validação de cupom (após resgate, antes de cupom) */
  const getCouponBaseValue = useCallback(() => {
    return getBaseTotalBeforeCoupon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServices, serviceQuantities, useRedemption, availableRedemptions]);

  /** Valida cupom de desconto via RPC validate_cupom */
  const validateCoupon = async (codeOverride?: string, opts?: { silent?: boolean }) => {
    const code = (codeOverride ?? couponCode).trim().toUpperCase();
    if (!code || code.length < 2) return;

    const tenantId = getCouponTenantId();
    if (!tenantId || !userId) {
      if (!opts?.silent) toast.error("Selecione a barbearia antes de aplicar o cupom");
      return;
    }

    const valorBase = getCouponBaseValue();

    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase.rpc("validate_cupom", {
        p_tenant_id: tenantId,
        p_codigo: code,
        p_user_id: userId,
        p_valor_base: valorBase,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : (data as any);
      if (!row || !row.valido) {
        if (!opts?.silent) toast.error(row?.motivo || "Cupom inválido");
        return;
      }

      setAppliedCoupon({
        id: row.cupom_id,
        code,
        tipo_desconto: (row.tipo_desconto === "fixo" ? "fixo" : "percentual"),
        valor_desconto: Number(row.valor_desconto || 0),
        valor_descontado: Number(row.valor_descontado || 0),
      });

      if (!opts?.silent) {
        const desc = row.tipo_desconto === "percentual"
          ? `${Number(row.valor_desconto)}% de desconto`
          : `R$ ${Number(row.valor_desconto).toFixed(2).replace(".", ",")} de desconto`;
        toast.success(`Cupom aplicado: ${desc}`);
      }
    } catch (err: any) {
      console.error("Error validating coupon:", err);
      if (!opts?.silent) toast.error(err?.message || "Erro ao validar cupom");
    } finally {
      setValidatingCoupon(false);
    }
  };

  /** Remove cupom aplicado */
  const removeCoupon = () => {
    if (appliedCoupon?.obrigatorio) {
      toast.error("Este cupom é obrigatório e não pode ser removido");
      return;
    }
    setAppliedCoupon(null);
    setCouponCode("");
  };

  /** Registra o uso do cupom após confirmação do agendamento (RPC apply_cupom) */
  const registerCouponUsage = async (appointmentId: string) => {
    if (!appliedCoupon || !userId) return;
    const tenantId = getCouponTenantId();
    if (!tenantId) return;

    try {
      const valorBase = getCouponBaseValue();
      const { data, error } = await supabase.rpc("apply_cupom", {
        p_tenant_id: tenantId,
        p_codigo: appliedCoupon.code,
        p_user_id: userId,
        p_agendamento_id: appointmentId,
        p_valor_base: valorBase,
      });

      const row = Array.isArray(data) ? data[0] : (data as any);
      if (error || !row?.ok) {
        console.error("apply_cupom falhou:", error || row?.motivo);
        toast.error(row?.motivo || "Não foi possível registrar o cupom (suporte avisado)");
        return;
      }

      const valorDescontado = Number(row.valor_descontado || appliedCoupon.valor_descontado || 0);
      const precoFinal = Math.max(0, valorBase - valorDescontado);

      await supabase
        .from("agendamentos")
        .update({
          cupom_id: appliedCoupon.id,
          desconto_aplicado: valorDescontado,
          preco_final: precoFinal,
        })
        .eq("id", appointmentId);
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
      
      const { data: rescheduleResult, error } = await supabase.functions.invoke('cancel-appointment-client', {
        body: {
          action: 'reschedule',
          appointmentId: rescheduleAppointmentId,
          data: dateStr,
          hora: bookingTime,
          duracao: totalDuration,
        },
      });

      if (error) throw error;
      if (rescheduleResult?.error) throw new Error(rescheduleResult.error);

      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');

      toast.success("Agendamento remarcado com sucesso!");
      setBookingSuccess(true);
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

  /**
   * Retorna o serviço de CORTE SIMPLES elegível para resgate de Corte Grátis.
   * Regras:
   * - Procura no carrinho qualquer serviço cujo nome contenha "corte" e NÃO seja combo
   *   (barba, +, " e ", mais, combo, pacote, duo, kit).
   * - Se houver mais de um corte simples, escolhe o de MENOR preço (o cliente paga o mais caro).
   * - Se o mesmo corte tiver qty > 1, ainda é válido: 1 unidade vira grátis e as demais são cobradas.
   * - O cliente pode ter outros serviços junto (alisante, barba, etc.) — só o corte simples é descontado.
   * O trigger no banco (consume_redemption_on_appointment_insert) garante que o servico_id resgatado
   * é um corte simples, independente dos demais serviços do carrinho.
   */
  const getCorteService = () => {
    if (!selectedServices || selectedServices.length === 0) return undefined;
    
    // Filtra apenas serviços que contenham a palavra exata "Corte"
    // para evitar que combos ou serviços com nomes compostos (ex: "Corte + Alisante")
    // sejam marcados como gratuitos por inteiro.
    const cortes = selectedServices.filter(s => {
      const name = (s.nome || "").toLowerCase();
      // O nome deve ser EXATAMENTE "corte" ou começar com "corte " (com espaço) 
      // ou terminar com " corte", ou ser cercado por espaços.
      // Isso evita "Corte + Algo" se o nome do serviço for o combo todo.
      return name.trim() === "corte";
    });

    if (cortes.length === 0) return undefined;
    
    // Escolhe o de maior preço caso haja mais de um "Corte" puro (raro)
    return cortes.reduce((max, s) => (s.preco > max.preco ? s : max), cortes[0]);
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

  /** Corte grátis por indicação: exclusivo para 1 corte único no carrinho. */
  const canUseReferralCredit =
    referralCredits > 0 &&
    selectedServices.length === 1 &&
    !!getCorteService();

  const getReferralDiscount = () => {
    if (!useReferralCredit || !canUseReferralCredit) return 0;
    const corteService = getCorteService();
    if (!corteService) return 0;
    const qty = serviceQuantities[corteService.id] || 1;
    return corteService.preco * qty;
  };

  /** Retorna o valor base SEM cupom (para exibição) */
  const getBaseTotalBeforeCoupon = () => {
    const baseTotal = selectedServices.reduce((sum, s) => sum + s.preco * (serviceQuantities[s.id] || 1), 0);
    const redemptionDiscount = getRedemptionDiscount();
    const referralDiscount = getReferralDiscount();
    return Math.max(0, baseTotal - redemptionDiscount - referralDiscount);
  };

  /** Retorna o valor do desconto do cupom (recalculado a partir do valor base atual) */
  const getCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    const base = getBaseTotalBeforeCoupon();
    if (appliedCoupon.tipo_desconto === "percentual") {
      return Math.max(0, base * (appliedCoupon.valor_desconto / 100));
    }
    // fixo
    return Math.min(base, appliedCoupon.valor_desconto);
  };

  const getTotalPrice = () => {
    const afterRedemption = getBaseTotalBeforeCoupon();
    return Math.max(0, afterRedemption - getCouponDiscount());
  };

  const pixAvailable = canReceivePix && pixHabilitado;
  const walletAvailable = canReceivePix && walletBalance > 0 && !paymentOptionsLoading && !paymentOptionsError &&
    (barbeariaHabilitado || walletBalance >= Math.max(0, getTotalPrice() - availableCredits));
  const availablePaymentMethods = {
    pix: pixAvailable, cash: barbeariaHabilitado, wallet: walletAvailable, card: false,
  };

  // Preserva a escolha válida e nunca mantém um método desativado.
  useEffect(() => {
    setPaymentMethod(current => resolveBookingPaymentMethod(current, {
      pix: pixAvailable, cash: barbeariaHabilitado, wallet: walletAvailable, card: false,
    }));
  }, [pixAvailable, barbeariaHabilitado, walletAvailable]);

  const canUseRedemption = !hasActiveRedemptionAppointment && availableRedemptions.length > 0 && !!getCorteService();
  // Pré-seleciona o corte grátis quando disponível, mas o cliente PODE optar por não usar.
  // Se ele seguir sem aplicar, será avisado e perderá a promoção (resgate consumido).
  const prevCanUseRedemptionRef = useRef(false);
  useEffect(() => {
    // Quando o resgate deixa de estar disponível, garantir que o estado é limpo.
    // NÃO pré-selecionamos mais o corte grátis automaticamente — o cliente precisa
    // tocar na opção "Corte Grátis Disponível" para aplicar o desconto.
    // Se ele escolher PIX/Carteira/Barbearia sem aplicar, paga o valor cheio e
    // o diálogo de confirmação avisa que perderá a promoção.
    if (!canUseRedemption && useRedemption) {
      setUseRedemption(false);
      redemptionAutoSelectedRef.current = false;
    }
    // Pré-seleciona o Corte Grátis automaticamente quando ele se torna disponível.
    if (canUseRedemption && !useRedemption && !redemptionAutoSelectedRef.current) {
      setUseRedemption(true);
      redemptionAutoSelectedRef.current = true;
    }
    prevCanUseRedemptionRef.current = canUseRedemption;
  }, [canUseRedemption, useRedemption]);

  // Se o corte grátis por indicação deixa de ser elegível (mudou o serviço,
  // adicionou combo, etc.), limpa a seleção para não travar em um estado
  // "aplicado" sem desconto.
  useEffect(() => {
    if (!canUseReferralCredit && useReferralCredit) {
      setUseReferralCredit(false);
    }
  }, [canUseReferralCredit, useReferralCredit]);

  const handleToggleRedemption = () => {
    if (!canUseRedemption) return;
    // Se está DESmarcando o corte grátis (estava ativo) → mesma regra anti-burla:
    // avisar uma vez antes de abrir mão do benefício.
    if (useRedemption) {
      if (!loseWarningShownRef.current) {
        setPendingPaymentMethod(null);
        setLoseDialogContext('toggle');
        setShowLoseRedemptionDialog(true);
        return;
      }
      redemptionAutoSelectedRef.current = true;
      setUseRedemption(false);
      return;
    }
    // Marcando: comportamento normal
    setUseRedemption(true);
  };

  const [profileCpf, setProfileCpf] = useState<string | null>(null);
  const [cpfInput, setCpfInput] = useState("");
  const [cpfError, setCpfError] = useState(false);

  /** Solicita o CPF apenas quando o cliente escolhe pagar via PIX. */
  const handleSelectPaymentMethod = (method: 'cash' | 'pix' | 'wallet') => {
    if (!availablePaymentMethods[method]) return;
    setCpfError(false);
    // Se há corte grátis ativo, avisar (apenas na primeira troca) antes de mudar para método pago.
    if (useRedemption && canUseRedemption) {
      if (!loseWarningShownRef.current) {
        setPendingPaymentMethod(method);
        setLoseDialogContext('switch');
        setShowLoseRedemptionDialog(true);
        return;
      }
      // Já avisado anteriormente — apenas desmarca o resgate e troca o método
      setUseRedemption(false);
      redemptionAutoSelectedRef.current = true;
    }
    setPaymentMethod(method);
  };

  /** Marca todos os resgates disponíveis como expirados (cliente abriu mão do corte grátis). */
  const consumeRedemptionsAsLost = async (appointmentId?: string) => {
    if (!canUseRedemption || useRedemption || availableRedemptions.length === 0) return;
    try {
      const resolvedUserId = userId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!resolvedUserId) throw new Error("Usuário não autenticado");

      const { error } = await (supabase as any).rpc("consume_available_redemptions_as_lost", {
        p_user_id: resolvedUserId,
        p_appointment_id: appointmentId ?? null,
        p_reason: "paid_booking_without_redemption",
      });

      if (error) throw error;

      setAvailableRedemptions([]);
      setUseRedemption(false);
    } catch (err) {
      console.error("Erro ao expirar resgates:", err);
      throw err;
    }
  };

  /** Ação do botão "Continuar" do passo 5 (pagamento). */
  const handleProceedFromPayment = async () => {
    // Se há corte grátis disponível e o cliente optou por NÃO usar → confirmar perda (1x)
    if (canUseRedemption && !useRedemption && !loseWarningShownRef.current) {
      setLoseDialogContext('continue');
      setShowLoseRedemptionDialog(true);
      return;
    }

    const redemptionCoversAll = useRedemption && getTotalPrice() === 0;
    const referralCoversAll = useReferralCredit && canUseReferralCredit && getTotalPrice() === 0;

    if (paymentMethod === 'pix' && !redemptionCoversAll && !referralCoversAll) {
      const digits = (cpfInput || "").replace(/\D/g, "");
      if (digits.length !== 11 || !validateCPF(digits)) {
        setCpfError(true);
        toast.error("Informe um CPF válido para gerar o PIX.");
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && digits !== profileCpf) {
          await supabase.from("profiles").update({ cpf: digits }).eq("id", user.id);
          setProfileCpf(digits);
        }
      } catch (err) {
        console.error("Erro ao salvar CPF:", err);
      }
    }

    if (paymentMethod === 'pix' || paymentMethod === 'card' || paymentMethod === 'cash') {
      handlePayment();
    } else {
      setStep(6);
    }
  };

  const handleConfirmLoseRedemption = async () => {
    loseWarningShownRef.current = true;
    setUseRedemption(false);
    redemptionAutoSelectedRef.current = true;
    setShowLoseRedemptionDialog(false);

    // Troca de método de pagamento
    if (loseDialogContext === 'switch' && pendingPaymentMethod) {
      setPaymentMethod(resolveBookingPaymentMethod(pendingPaymentMethod, availablePaymentMethods));
      setPendingPaymentMethod(null);
      return;
    }

    // Desmarcou o corte grátis manualmente — apenas mantém desmarcado
    if (loseDialogContext === 'toggle') {
      setPendingPaymentMethod(null);
      return;
    }

    // Continuar sem aplicar o corte → prossegue para pagamento
    if (paymentMethod === 'pix' || paymentMethod === 'card' || paymentMethod === 'cash') {
      handlePayment();
    } else {
      setStep(6);
    }
  };


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

  // Garante que o scroll sempre volte ao topo ao mudar de etapa, evitando títulos cortados/desaparecidos
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [step]);

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
          
          <h1 className="text-2xl font-medium text-foreground mb-3">
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
    <div 
      ref={containerRef}
      className="h-full w-full bg-[#FFFFFF] relative overflow-y-auto overscroll-contain touch-pan-y"
    >
      {/* Header fixo — Seta + Dots (Exata mesma cor sólida do fundo da tela: #FFFFFF) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#FFFFFF]">
        <div className="max-w-2xl mx-auto px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-white border border-neutral-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 active:scale-90 transition-transform cursor-pointer"
            >
              <BackArrow size={20} strokeWidth={2.2} />
            </button>

            <StepDots currentStep={currentDisplayStep} totalSteps={totalSteps} />

            <div className="w-10" />
          </div>
        </div>
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
            className="pt-16 pb-32 px-4 relative z-10"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Escolha o profissional
                </h2>
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
            className="pt-16 pb-32 px-4 relative z-10"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Escolha o serviço
                </h2>
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

              <FloatingActionBar
                isVisible={selectedServices.length > 0}
                onContinue={handleNextStep}
                label="Continuar"
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
            className="pt-16 pb-24 px-4 relative z-10"
          >
             <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Melhor dia pra você
                </h2>
              </div>
              <PremiumCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date); syncBookingData(); }}
                closedDates={closedDates}
                closedWeekdays={closedWeekdays}
                onMonthChange={loadClosedDates}
                loading={closedDatesLoading}
              />

            <FloatingActionBar
              isVisible={!!selectedDate}
              onContinue={handleNextStep}
              label="Continuar"
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
            className="pt-16 pb-32 px-4 relative z-10"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Que horas fica bom?
                </h2>
              </div>
              {(loadingSlots && availableSlots.length === 0) || (!slotsHasLoaded && availableSlots.length === 0) ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-primary animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">Carregando horários de {selectedBarber?.apelido}...</p>
                </div>
              ) : availableSlots.filter(slot => slot.available).length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  {(() => {
                    // Detectar motivo real do bloqueio
                    const isClosedDay = selectedDate && closedDates.some(
                      d => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                    );
                    const noSlotsGenerated = availableSlots.length === 0;

                    if (isClosedDay || noSlotsGenerated) {
                      return (
                        <p className="text-muted-foreground font-medium mb-4">
                          {selectedBarber?.apelido} não atende neste dia.
                        </p>
                      );
                    }

                    // Analisar razões do bloqueio dos slots
                    const reasons = availableSlots
                      .filter(s => !s.available)
                      .map(s => s.blockedReason || 'occupied');
                    const total = reasons.length;
                    const countOccupied = reasons.filter(r => r === 'occupied').length;
                    const countMinAdvance = reasons.filter(r => r === 'minimum_advance').length;
                    const countLunch = reasons.filter(r => r === 'lunch' || (r as string) === 'lunch_buffer').length;

                    // Se todos os bloqueios forem por antecedência mínima → expediente acabando
                    if (countMinAdvance > 0 && (countMinAdvance + countLunch) === total) {
                      return (
                        <p className="text-muted-foreground font-medium mb-4">
                          Sem horários disponíveis hoje para {selectedBarber?.apelido}. O expediente está encerrando — tente outra data.
                        </p>
                      );
                    }

                    // Se há ocupação real, é agenda cheia
                    if (countOccupied > 0) {
                      return (
                        <p className="text-muted-foreground font-medium mb-4">
                          {selectedBarber?.apelido} está com agenda cheia neste dia.
                        </p>
                      );
                    }

                    return (
                      <p className="text-muted-foreground font-medium mb-4">
                        Sem horários disponíveis para {selectedBarber?.apelido} neste dia.
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
                      serviceDuration={totalDuration}
                      tenantId={availabilityTenantId}
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

                  <FloatingActionBar
                    isVisible={!!selectedTime}
                    onContinue={handleNextStep}
                    label="Continuar"
                    isLoading={loading}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}

        {step === 5 && !isRescheduling && !isPlanFlow && (
          <motion.div
            key="step-4"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="pt-16 pb-36 px-4 relative z-10"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Pagamento
                </h2>
              </div>

              {pendingSubscription && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setPendingDrawerOpen(true)}
                  className="mb-5 bg-primary/10 border border-primary/20 rounded-2xl p-4 cursor-pointer relative overflow-hidden group"
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground">
                        {pendingSubscription.status === 'pending_renewal'
                          ? "Renovação de plano pendente"
                          : "Assinatura pendente detectada"}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        Finalize o pagamento para liberar seu agendamento
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              )}

              {(() => {
                const totalPrice = getTotalPrice();
                const walletCoversAll = walletBalance >= totalPrice;
                const walletRemainder = Math.max(0, totalPrice - walletBalance);
                const walletDebit = Math.min(walletBalance, totalPrice);
                const walletIsSelected = paymentMethod === 'wallet' && !useRedemption;

                const redemptionCoversAll = useRedemption && totalPrice === 0;
                const referralCoversAll = useReferralCredit && canUseReferralCredit && getTotalPrice() === 0;

                return (
                  <div className="rounded-[22px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-2 space-y-1 mb-5">
                      {canUseReferralCredit && (
                        <PaymentOption
                          value="referral"
                          selected={useReferralCredit}
                          onSelect={() => setUseReferralCredit((v) => !v)}
                          title="Usar Corte Grátis de Indicação"
                          description={useReferralCredit
                            ? "Benefício aplicado — este agendamento será gratuito."
                            : `Você tem ${referralCredits} corte${referralCredits > 1 ? 's' : ''} grátis por indicação.`}
                          highlight={true}
                          icon={<Star className={cn("w-5 h-5", useReferralCredit ? "fill-gold text-gold" : "text-muted-foreground/40")} />}
                        />
                      )}

                      {canUseRedemption && (
                        <PaymentOption
                          value="redemption"
                          selected={useRedemption}
                          onSelect={handleToggleRedemption}
                          title="Corte Grátis Disponível!"
                          description={useRedemption
                            ? "Benefício aplicado."
                            : "Toque para aplicar seu benefício de fidelidade."}
                          highlight={true}
                          icon={<Star className={cn("w-5 h-5", useRedemption ? "fill-gold text-gold" : "text-muted-foreground/40")} />}
                        />
                      )}

                      {paymentOptionsLoading && (
                        <p role="status" className="flex items-center gap-2 p-3.5 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Carregando pagamento...
                        </p>
                      )}
                      {paymentOptionsError && (
                        <p role="alert" className="p-3.5 text-sm text-destructive">Não foi possível consultar as formas de pagamento. Tente novamente em instantes.</p>
                      )}
                      {!paymentOptionsLoading && !paymentOptionsError && !pixAvailable && !barbeariaHabilitado && !walletAvailable && (
                        <p role="status" className="p-3.5 text-sm text-muted-foreground">Nenhuma forma de pagamento disponível para este profissional.</p>
                      )}
                      {pixAvailable && (
                        <div>
                          <PaymentOption
                            value="pix"
                            selected={paymentMethod === 'pix' && !redemptionCoversAll && !referralCoversAll}
                            onSelect={() => handleSelectPaymentMethod('pix')}
                            title="PIX"
                            description="Confirmação instantânea e segura"
                            icon={<img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />}
                          />
                          
                          <AnimatePresence>
                            {paymentMethod === 'pix' && !redemptionCoversAll && !referralCoversAll && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden px-1 pb-1 pt-1"
                              >
                                <div className={cn(
                                  "p-3.5 rounded-xl transition-all",
                                  cpfError 
                                    ? "bg-red-50/90 border-2 border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" 
                                    : "bg-neutral-50/80 border border-neutral-200/70"
                                )}>
                                  <label className={cn("text-[11px] font-semibold block mb-1.5 transition-colors", cpfError ? "text-red-600" : "text-neutral-500")}>
                                    {cpfError ? "Informe um CPF válido para continuar" : "CPF para emissão do PIX (obrigatório)"}
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={cpfInput}
                                    onChange={(e) => {
                                      setCpfInput(formatCPF(e.target.value));
                                      if (cpfError) setCpfError(false);
                                    }}
                                    placeholder="000.000.000-00"
                                    className={cn(
                                      "w-full bg-transparent border-none outline-none text-[15px] font-medium placeholder:text-neutral-300 transition-colors",
                                      cpfError ? "text-red-700 font-semibold" : "text-neutral-900"
                                    )}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {walletAvailable && (
                        <PaymentOption
                          value="wallet"
                          selected={paymentMethod === 'wallet' && !redemptionCoversAll && !referralCoversAll}
                          onSelect={() => handleSelectPaymentMethod('wallet')}
                          title="Pagar com Carteira"
                          description={`Saldo: R$ ${walletBalance.toFixed(2).replace('.', ',')}`}
                          icon={<Wallet className={cn("w-5 h-5", paymentMethod === 'wallet' && !redemptionCoversAll && !referralCoversAll ? "text-emerald-500" : "text-muted-foreground/40")} />}
                        />
                      )}

                      {barbeariaHabilitado && <PaymentOption
                        value="cash"
                        selected={paymentMethod === 'cash' && !redemptionCoversAll && !referralCoversAll}
                        onSelect={() => handleSelectPaymentMethod('cash')}
                        title="Pagar na Barbearia"
                        description="Pagamento presencial no dia"
                        icon={<Landmark className={cn("w-5 h-5", paymentMethod === 'cash' && !redemptionCoversAll && !referralCoversAll ? "text-primary" : "text-muted-foreground/40")} />}
                      />}

                    <AnimatePresence>
                      {walletIsSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden px-1 pb-1 pt-1"
                        >
                          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3 space-y-2">
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
                            <div className="border-t border-border/30 pt-2 flex items-center justify-between">
                              {walletCoversAll ? (
                                <>
                                  <span className="text-[11px] font-medium text-emerald-500/90">Coberto pela carteira</span>
                                  <span className="text-[13px] font-medium text-emerald-500 tabular-nums">R$ 0,00</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[11px] font-medium text-foreground/70">Pagar na barbearia</span>
                                  <span className="text-[13px] font-medium text-foreground tabular-nums">
                                    R$ {walletRemainder.toFixed(2).replace('.', ',')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

              <div className="mb-5">
                <p className="text-[13px] font-medium text-neutral-500 mb-2 px-1">
                  Local do Atendimento
                </p>
                <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="w-5 h-5 text-neutral-700 flex-shrink-0" strokeWidth={1.8} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-neutral-900 truncate">
                        {preferredShop?.nome || "Barbearia DUB"}
                      </p>
                      <p className="text-[12px] text-neutral-500 truncate mt-0.5">
                        {selectedBarber ? `${selectedBarber.apelido} • ` : ""}{selectedDate ? format(selectedDate, "dd 'de' MMM", { locale: ptBR }) : ""} às {selectedTime}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                </div>
              </div>

              <div className="mb-5">
                <p className="text-[13px] font-medium text-neutral-500 mb-2 px-1">
                  Cupom de Desconto
                </p>
                <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-3.5">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Tag className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={1.8} />
                        <div>
                          <span className="text-[14px] font-medium text-neutral-900">{appliedCoupon.code}</span>
                          <span className="text-[12px] text-emerald-600 ml-2 font-semibold">
                            {appliedCoupon.tipo_desconto === "percentual"
                              ? `-${appliedCoupon.valor_desconto}%`
                              : `-R$ ${appliedCoupon.valor_desconto.toFixed(2).replace(".", ",")}`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={removeCoupon}
                        className="text-[12px] text-red-500 hover:text-red-600 font-medium px-2 py-1"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Tag className="w-5 h-5 text-neutral-500 flex-shrink-0" strokeWidth={1.8} />
                        <span className="text-[14px] font-medium text-neutral-700">Código promocional</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="INSERIR CÓDIGO"
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
                          className="text-right bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200/70 outline-none text-[12px] text-neutral-900 placeholder:text-neutral-400 font-medium w-36 uppercase focus:border-neutral-900 transition-colors"
                        />
                        {validatingCoupon && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="w-3 h-3 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[13px] font-medium text-neutral-500 mb-2 px-1">
                  Resumo
                </p>
                <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 space-y-3">
                  {(() => {
                    const redeemedCorte = useRedemption ? getCorteService() : undefined;
                    const referralCorte = useReferralCredit && canUseReferralCredit ? getCorteService() : undefined;
                    let redemptionApplied = false;
                    return selectedServices.map((s) => {
                      const qty = serviceQuantities[s.id] || 1;
                      const isRedeemed = !!redeemedCorte && s.id === redeemedCorte.id && !redemptionApplied;
                      if (isRedeemed) redemptionApplied = true;
                      
                      const isReferralFree = !!referralCorte && s.id === referralCorte.id;
                      const lineTotal = isReferralFree
                        ? 0
                        : isRedeemed
                          ? s.preco * Math.max(0, qty - 1)
                          : s.preco * qty;
                      
                      const showFreeLabel = isReferralFree || (isRedeemed && qty === 1);
                      return (
                        <div key={s.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-neutral-600 truncate">
                            {s.nome}{qty > 1 ? ` ×${qty}` : ""}{showFreeLabel ? " (Grátis)" : ""}
                          </span>
                          <span className={cn("tabular-nums font-medium flex-shrink-0", showFreeLabel ? "text-emerald-600" : "text-neutral-900")}>
                            R$ {lineTotal.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      );
                    });
                  })()}

                  {availableCredits > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-600">Créditos do plano</span>
                      <span className="text-emerald-600 font-medium tabular-nums">
                        − R$ {Math.min(availableCredits, getTotalPrice()).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}

                  {appliedCoupon && getCouponDiscount() > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-emerald-600 font-medium">Cupom ({appliedCoupon.code})</span>
                      <span className="text-emerald-600 font-medium tabular-nums">
                        − R$ {getCouponDiscount().toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}

                  {(() => {
                    const redemptionCoversAll = useRedemption && getTotalPrice() === 0;
                    const referralCoversAll = useReferralCredit && canUseReferralCredit && getTotalPrice() === 0;
                    const coversAll = redemptionCoversAll || referralCoversAll;
                    const fee = coversAll ? 0 : getServiceFee(paymentMethod);
                    const total = coversAll ? 0 : Math.max(0, getTotalPrice() - availableCredits - getCouponDiscount()) + fee;
                    return (
                      <>
                        {fee > 0 && (
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-neutral-600">Taxa de serviço</span>
                            <span className="text-neutral-900 font-medium tabular-nums">
                              R$ {fee.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        )}

                        <div className="border-b border-dashed border-neutral-200 my-2" />

                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[14px] font-medium text-neutral-900">Total</span>
                          <span className={cn("text-[18px] font-bold tabular-nums", coversAll ? "text-emerald-600" : "text-neutral-900")}>
                            R$ {total.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
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
            className="pt-16 pb-24 px-4 relative z-10"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Confirmar Agendamento
                </h2>
              </div>

              {/* Card de resumo - Layout limpo para plano */}
              <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 space-y-4 mb-6">
                <SummaryRow 
                  label="Serviço"
                  value={getFormattedServiceNames()}
                />
                
                <div className="border-t border-neutral-100" />
                
                <SummaryRow 
                  label="Duração"
                  value={`${getTotalDuration()} minutos`}
                />
                
                <div className="border-t border-neutral-100" />
                
                <SummaryRow 
                  label="Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />
                
                <div className="border-t border-neutral-100" />
                
                <SummaryRow 
                  label="Horário"
                  value={`${selectedTime} → ${getEndTime()}`}
                />
              </div>

              {/* Card do Plano - Destaque elegante */}
              <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">{activeSubscription?.plano_nome}</p>
                    <p className="text-xs text-neutral-500">Plano ativo</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-neutral-100">
                  <span className="text-sm text-neutral-500">Agendamentos no plano</span>
                  <span className="text-sm font-semibold text-neutral-900">
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
            className="pt-16 pb-28 px-4 relative z-10"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Tudo certo?
                </h2>
              </div>

              {/* Card de resumo */}
              <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 space-y-4 mb-6">
                <SummaryRow 
                  label="Serviço"
                  value={getFormattedServiceNames()}
                />

                <div className="border-t border-neutral-100" />

                <SummaryRow 
                  label="Duração"
                  value={`${getTotalDuration()} minutos`}
                />
                
                <div className="border-t border-neutral-100" />
                
                <SummaryRow 
                  label="Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />
                
                <div className="border-t border-neutral-100" />
                
                <SummaryRow 
                  label="Horário"
                  value={`${selectedTime} → ${getEndTime()}`}
                />
                
                <div className="border-t border-neutral-100" />
                
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
                    <div className="border-t border-neutral-100" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-600 font-medium">
                        Cupom {appliedCoupon.code}
                        {appliedCoupon.tipo_desconto === "percentual"
                          ? ` (${appliedCoupon.valor_desconto}%)`
                          : ""}
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">-R$ {getCouponDiscount().toFixed(2).replace('.', ',')}</span>
                    </div>
                  </>
                )}
                
                <div className="border-t border-dashed border-neutral-200 mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium text-neutral-900">Total</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] text-neutral-500">R$</span>
                      <span className="text-xl font-bold text-neutral-900 tabular-nums">
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
            className="pt-16 pb-28 px-4 relative z-10"
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 pt-1">
                <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                  Confirmar Remarcação
                </h2>
                <p className="text-[13px] text-neutral-500 mt-1">
                  Revise os novos dados.
                </p>
              </div>

              <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 space-y-4 mb-6">
                <SummaryRow 
                  label="Nova Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />

                <div className="border-t border-neutral-100" />

                <SummaryRow 
                  label="Novo Horário"
                  value={`${selectedTime} → ${getEndTime()}`}
                />

                <div className="border-t border-neutral-100" />

                <SummaryRow 
                  label="Serviço"
                  value={selectedServices[0]?.nome || ""}
                />
              </div>



              <FloatingActionBar
                isVisible={true}
                onContinue={handleRescheduleUpdate}
                label={processingPayment ? 'Remarcando...' : 'Confirmar'}
                isLoading={processingPayment}
                loadingLabel="Remarcando..."
              />
            </div>
          </motion.div>
        )}

        {/* PIX step removed - migrated to Stripe */}
      </AnimatePresence>

      {/* Floating Bottom Bar — Step 5 Pagamento */}
      <AnimatePresence>
        {step === 5 && !isRescheduling && !isPlanFlow && (paymentMethod || getTotalPrice() === 0) && (
          (() => {
            const redemptionCoversAll = useRedemption && getTotalPrice() === 0;
            const referralCoversAll = useReferralCredit && canUseReferralCredit && getTotalPrice() === 0;
            const coversAll = redemptionCoversAll || referralCoversAll;
            const actionTotal = coversAll
              ? 0
              : Math.max(0, getTotalPrice() - availableCredits) + getServiceFee(paymentMethod);
            const actionLabel = coversAll
              ? 'Confirmar'
              : paymentMethod === 'pix'
                ? 'Gerar PIX'
                : paymentMethod === 'card'
                  ? 'Pagar'
                  : paymentMethod === 'cash'
                    ? 'Finalizar'
                    : 'Revisar pedido';

            return (
              <FloatingActionBar
                isVisible={true}
                onContinue={handleProceedFromPayment}
                label={actionLabel}
                isLoading={processingPayment}
                loadingLabel="Processando..."
              />
            );
          })()
        )}
      </AnimatePresence>





      {/* Diálogo: perder corte grátis ao seguir sem aplicar */}
      <Dialog open={showLoseRedemptionDialog} onOpenChange={(open) => {
        if (!open) {
          setShowLoseRedemptionDialog(false);
          setPendingPaymentMethod(null);
        }
      }}>
        <DialogContent className="max-w-[80vw] md:max-w-[340px] rounded-[32px] border border-white/20 bg-white/95 backdrop-blur-sm p-0 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] focus:outline-none [&>button]:hidden">
          <button
            type="button"
            aria-label="Fechar"
            disabled={consumingRedemption}
            onClick={() => { setShowLoseRedemptionDialog(false); setPendingPaymentMethod(null); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="p-7 text-center">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-[19px] font-medium text-zinc-900 tracking-tight leading-tight">
                Você tem um benefício pendente
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-relaxed text-zinc-600 px-1">
                Se você continuar sem selecionar o <span className="text-zinc-900 font-semibold">Corte Grátis</span>, você perderá essa promoção definitivamente. Deseja prosseguir mesmo assim?
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7">
              <Button
                disabled={consumingRedemption}
                onClick={(e) => { e.preventDefault(); handleConfirmLoseRedemption(); }}
                className="w-full h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-[14px] tracking-tight transition-all border-none active:scale-[0.98]"
              >
                {consumingRedemption ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : "Sim, desejo perder"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Drawer de Sucesso (Agendamento Concluído - Estilo Referência) */}
      <AnimatePresence>
        {bookingSuccess && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => navigate("/cliente")}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-[390px] bg-white rounded-t-[36px] sm:rounded-[36px] px-6 pt-9 pb-8 text-center shadow-2xl z-10 mx-auto overflow-hidden"
            >
              {/* Badge 3D com partículas de confete sutis */}
              <div className="relative mx-auto w-28 h-28 flex items-center justify-center mb-5">
                {/* Partículas de confete flutuantes */}
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 absolute top-2 left-4 animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-neutral-500 absolute top-1 right-8" />
                <div className="w-2 h-2 rounded-full bg-neutral-300 absolute bottom-4 left-2" />
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 absolute top-8 right-3" />
                <div className="w-1 h-1 rounded-full bg-neutral-600 absolute bottom-2 right-6" />
                <div className="w-1 h-1 rounded-full bg-neutral-300 absolute top-5 left-10" />

                {/* Selo 3D Medalhão */}
                <div className="w-[86px] h-[86px] rounded-full p-[7px] bg-gradient-to-b from-[#EEEEEE] via-[#DADADA] to-[#BCBCBC] shadow-[0_12px_24px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.06)] flex items-center justify-center border border-white/70">
                  <div className="w-full h-full rounded-full bg-gradient-to-b from-[#222222] to-[#0A0A0A] flex items-center justify-center shadow-inner relative overflow-hidden">
                    {/* Brilho superior sutil */}
                    <div className="absolute top-0 inset-x-0 h-1/2 bg-white/10 rounded-t-full pointer-events-none" />
                    <Check className="w-8 h-8 text-white stroke-[3.2]" />
                  </div>
                </div>
              </div>

              <h2 className="text-[22px] sm:text-[23px] font-semibold text-neutral-900 mb-2 tracking-tight">
                Agendamento Confirmado!
              </h2>
              <p className="text-[13px] text-neutral-400 font-normal leading-relaxed max-w-[270px] mx-auto mb-8">
                Tudo pronto! Seu horário foi reservado com sucesso. Acompanhe os detalhes em Meus Agendamentos.
              </p>
              
              {/* Botões de Ação estilo Checkout da Referência */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/cliente")}
                  className="w-full flex items-center justify-center h-14 rounded-full font-medium tracking-wide text-[15px] text-white bg-[#18181B] hover:bg-black active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
                >
                  Ir para o Início
                </button>
                <button
                  onClick={() => navigate("/cliente/historico")}
                  className="w-full flex items-center justify-center h-14 rounded-full font-medium tracking-wide text-[15px] text-neutral-800 bg-neutral-100 hover:bg-neutral-200/80 active:scale-[0.98] transition-all"
                >
                  Ver Meus Agendamentos
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pending Subscription Drawer */}
      <PendingSubscriptionDrawer
        open={pendingDrawerOpen}
        onOpenChange={setPendingDrawerOpen}
        planName={(pendingSubscription as any)?.plano?.nome || "Plano"}
        onFinalize={() => {
          const ps = pendingSubscription as any;
          if (ps.payment_method === "pix" && ps.pix_qr_code && ps.pix_expires_at) {
            const pixExpiresAt = new Date(ps.pix_expires_at).getTime();
            if (pixExpiresAt > Date.now()) {
              const pixCheckoutData = {
                pixQrCode: ps.pix_qr_code,
                pixPayload: ps.pix_payload,
                subscriptionId: ps.id,
                asaasPaymentId: ps.asaas_payment_id,
                expiresAt: ps.pix_expires_at,
                value: ps.plano?.preco_mensal || 0,
                planName: ps.plano?.nome || "Plano",
              };
              sessionStorage.setItem("subscription_pix_checkout_data", JSON.stringify(pixCheckoutData));
              navigate("/cliente/assinatura-pix");
              return;
            }
          }
          navigate("/cliente/assinar", { 
            state: { resumePlanId: ps.plano_id }
          });
        }}
        onCancel={handleCancelSubscription}
        isCanceling={isCancelingSubscription}
      />
    </div>
  );
};

export default ClienteAgendar;
