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
  const [useRedemption, setUseRedemption] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [showLoseRedemptionDialog, setShowLoseRedemptionDialog] = useState(false);
  const [consumingRedemption, setConsumingRedemption] = useState(false);
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

  // Fonte única do barbeiro selecionado (fallback para assinatura vinculada)
  const selectedBarberId = selectedBarber?.id || activeSubscription?.barbeiro_id || null;

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

  // Auto-seleciona método de pagamento: PIX se o barbeiro aceitar, senão "pagar na barbearia".
  useEffect(() => {
    if (canReceivePix) {
      if (paymentMethod === 'cash') setPaymentMethod('pix');
    } else if (paymentMethod === 'pix' || paymentMethod === 'wallet') {
      setPaymentMethod('cash');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReceivePix, selectedBarberId]);
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
    const filterBlocked = (list: Barber[]) => list.filter(b => !blockedBarberIds.includes(b.id));
    setBarbers(filterBlocked(filtered.data || []));
    setAllBarbers(filterBlocked(all.data || []));
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

      const profilePromise = uid
        ? supabase
            .from("profiles")
            .select("barbearia_preferida_id, unidade_preferida_id")
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

      // ══════════════════════════════════════════════════════════════
      // FAST-PATH: Check subscription FIRST to skip heavy queries
      // for plan users (barbers list, credits, redemptions, etc.)
      // ══════════════════════════════════════════════════════════════
      if (!resumePaymentRaw) {
        if (subscription) {
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
            
            // Se tiver APENAS UM serviço, pré-seleciona e vai para o passo da data
            if (subscription.servicos.length === 1 && subscription.barbeiro) {
              setSelectedServices([subscription.servicos[0]]);
              setStep(3);
            } else if (subscription.servicos.length > 1 && subscription.barbeiro) {
              // Se tiver múltiplos serviços, precisa escolher um (Step 2)
              setStep(2);
            } else {
              // Sem barbeiro, precisa escolher barbeiro (Step 1)
              await loadBarbers(tenantId, null);
              setStep(1);
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
      // NORMAL PATH: Non-plan users — load everything
      // ══════════════════════════════════════════════════════════════

      // Carregar unidades do tenant
      let units: TenantUnit[] = [];
      let effectiveUnitId: string | null = null;
      
      if (tenantId) {
        units = await loadTenantUnits(tenantId);
        
        if (userPreferredUnitId && units.find(u => u.id === userPreferredUnitId)) {
          const preferredUnit = units.find(u => u.id === userPreferredUnitId)!;
          setSelectedUnit(preferredUnit);
          effectiveUnitId = preferredUnit.id;
        }
      }

      const [barbersList] = await Promise.all([
        loadBarbers(tenantId, effectiveUnitId),
        loadUserCreditsOptimized(uid),
        loadAvailableRedemptionsOptimized(uid),
      ]);

      // Auto-select barber from query param
      if (barberFromParam && barbersList) {
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

      await loadServices(tenantId);
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
    let finalServices = allServices || [];

    // Se cliente tem plano ativo e está em fluxo de plano, restringir aos serviços vinculados
    if (isPlanFlow && activeSubscription?.servicos && activeSubscription.servicos.length > 0) {
      const permittedIds = activeSubscription.servicos.map(s => s.id);
      finalServices = finalServices.filter((s) => permittedIds.includes(s.id));
    }


    setServices(finalServices);
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
          .in("status", ["pending", "confirmed"])
          .limit(1),
        supabase
          .from("resgates")
          .select("id, promocao_id")
          .eq("user_id", uid)
          .eq("status", "available")
          .is("used_at", null)
          .order("created_at", { ascending: true }),
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
      const [globalConfigResult, barberConfigResult, globalExcResult, barberExcResult] = await Promise.all([
        supabase.from('configuracoes_horario').select('dia_semana, aberto'),
        barbeiroId
          ? supabase.from('configuracoes_horario_barbeiro').select('dia_semana, aberto').eq('barbeiro_id', barbeiroId)
          : Promise.resolve({ data: null as { dia_semana: number; aberto: boolean }[] | null }),
        supabase.from('horarios_excepcionais').select('data, aberto').gte('data', startStr).lte('data', endStr),
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
      const safeBarbers = (nextBarbers || []).filter(b => !blockedBarberIds.includes(b.id));

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
        metodo: useRedemption ? 'resgate' : 'cash',
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
        toast.error("Erro ao processar pagamento: " + (errorMessage || "Erro desconhecido"));
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
          payment_method: 'cash', // Alterado de 'resgate' para 'cash' para o markRedemptionAsUsed cuidar disso manualmente
          is_free: true,
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          unidade_id: selectedUnit?.id || null,
        } as any)
        .select()
        .single();

      if (aptError) throw aptError;

      await markRedemptionAsUsed(appointment.id);
      
      // Atualiza o agendamento para refletir que o pagamento foi via resgate
      // Fazemos isso após o markRedemptionAsUsed para garantir que o resgate foi vinculado corretamente
      await supabase
        .from("agendamentos")
        .update({ payment_method: 'resgate' } as any)
        .eq("id", appointment.id);

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
        
        // Atualiza o agendamento para refletir que o pagamento foi via resgate
        await supabase
          .from("agendamentos")
          .update({ payment_method: 'resgate' } as any)
          .eq("id", appointment.id);
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
    
    setConsumingRedemption(true);
    // Usar o mesmo critério do trigger (mais antigo primeiro)
    const redemptionToUse = availableRedemptions[0];
    
    try {
      // Primeiro verifica se o gatilho já não o marcou como usado
      const { data: currentResgate } = await supabase
        .from("resgates")
        .select("status, appointment_id")
        .eq("id", redemptionToUse.id)
        .single();

      if (currentResgate?.status === 'used' && currentResgate?.appointment_id === appointmentId) {
        console.log("Resgate já processado pelo gatilho do banco.");
      } else {
        const { error } = await supabase
          .from("resgates")
          .update({
            status: "used",
            used_at: new Date().toISOString(),
            appointment_id: appointmentId
          })
          .eq("id", redemptionToUse.id);

        if (error) throw error;
      }

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
    const comboKeywords = ["barba", "+", " e ", "mais", "combo", "pacote", "duo", "kit"];
    const cortes = selectedServices.filter(s => {
      const name = (s.nome || "").toLowerCase();
      if (!name.includes("corte")) return false;
      return !comboKeywords.some(k => name.includes(k));
    });
    if (cortes.length === 0) return undefined;
    // Escolhe o corte de MENOR preço (mais justo: cliente paga o item mais caro).
    return cortes.reduce((min, s) => (s.preco < min.preco ? s : min), cortes[0]);
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

  /** Retorna o valor base SEM cupom (para exibição) */
  const getBaseTotalBeforeCoupon = () => {
    const baseTotal = selectedServices.reduce((sum, s) => sum + s.preco * (serviceQuantities[s.id] || 1), 0);
    const redemptionDiscount = getRedemptionDiscount();
    return Math.max(0, baseTotal - redemptionDiscount);
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

  const canUseRedemption = availableRedemptions.length > 0 && !!getCorteService();
  // Pré-seleciona o corte grátis quando disponível, mas o cliente PODE optar por não usar.
  // Se ele seguir sem aplicar, será avisado e perderá a promoção (resgate consumido).
  const prevCanUseRedemptionRef = useRef(false);
  useEffect(() => {
    const prev = prevCanUseRedemptionRef.current;
    if (canUseRedemption && !prev) {
      // acabou de ficar elegível → pré-seleciona o corte grátis como desconto.
      // Só força método 'cash' quando o resgate cobre 100% (carrinho com 1 corte simples).
      setUseRedemption(true);
      const baseTotal = selectedServices.reduce((sum, s) => sum + s.preco * (serviceQuantities[s.id] || 1), 0);
      const corte = getCorteService();
      const fullyCovered = corte ? baseTotal - corte.preco <= 0 : false;
      if (fullyCovered) setPaymentMethod('cash');
    }
    if (!canUseRedemption && useRedemption) {
      setUseRedemption(false);
    }
    prevCanUseRedemptionRef.current = canUseRedemption;
  }, [canUseRedemption]);

  /** Marca todos os resgates disponíveis como expirados (cliente abriu mão do corte grátis). */
  const consumeRedemptionsAsLost = async () => {
    if (!userId || availableRedemptions.length === 0) return;
    const ids = availableRedemptions.map(r => r.id);
    try {
      await supabase
        .from("resgates")
        .update({ status: "expired", expired_at: new Date().toISOString() })
        .in("id", ids);
      setAvailableRedemptions([]);
    } catch (err) {
      console.error("Erro ao expirar resgates:", err);
    }
  };

  /** Ação do botão "Continuar" do passo 5 (pagamento). */
  const handleProceedFromPayment = async () => {
    // Se há corte grátis disponível e o cliente optou por NÃO usar → confirmar perda
    if (canUseRedemption && !useRedemption) {
      setShowLoseRedemptionDialog(true);
      return;
    }
    
    // Se o cliente tem um corte grátis mas o serviço de corte NÃO está selecionado,
    // ele também deve ser avisado que perderá o benefício se prosseguir sem ele?
    // O usuário disse: "quando ele tem a opção ali de corte grátis... tem que aparecer essa opção... 
    // mas também se o cliente ele selecionar pagar na barbearia... e não selecionar o corte grátis, 
    // vai aparecer uma tela... falando pra ele... ele vai perder a promoção"
    
    if (paymentMethod === 'pix' || paymentMethod === 'card' || paymentMethod === 'cash') {
      handlePayment();
    } else {
      setStep(6);
    }
  };

  const handleConfirmLoseRedemption = async () => {
    setConsumingRedemption(true);
    await consumeRedemptionsAsLost();
    setConsumingRedemption(false);
    setShowLoseRedemptionDialog(false);
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
    <div 
      ref={containerRef}
      className="h-screen overflow-y-auto overscroll-contain bg-background"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
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
                closedWeekdays={closedWeekdays}
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
              {/* Header estilo Sacola */}
              <div className="mb-5 pt-1 text-center">
                <h2 className="text-[13px] font-bold text-foreground uppercase tracking-[0.2em]">
                  Agendamento
                </h2>
              </div>

              {/* Brand / Barbeiro row */}
              <div className="flex items-center gap-3 mb-6 px-1">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-muted/20 flex items-center justify-center flex-shrink-0">
                  {selectedBarber?.foto_url ? (
                    <img src={selectedBarber.foto_url} alt={selectedBarber.apelido} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-[14px] font-bold text-primary">
                      {selectedBarber?.apelido?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-foreground leading-tight">
                    {selectedBarber?.apelido}
                  </p>
                  <p className="text-[12px] text-primary/80 font-medium leading-tight mt-0.5">
                    {getFormattedServiceNames()} • {getTotalDuration()} min
                  </p>
                </div>
              </div>

              {/* Alerta de Assinatura Pendente */}
              {pendingSubscription && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setPendingDrawerOpen(true)}
                  className="mb-6 bg-primary/10 border border-primary/20 rounded-xl p-4 cursor-pointer relative overflow-hidden group"
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-foreground">
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

              {/* Section: Forma de pagamento (linha única + sheet) */}
              {(() => {
                const totalPrice = getTotalPrice();
                const walletCoversAll = walletBalance >= totalPrice;
                const walletRemainder = Math.max(0, totalPrice - walletBalance);
                const walletDebit = Math.min(walletBalance, totalPrice);
                const walletIsSelected = paymentMethod === 'wallet' && !useRedemption;

                // Resumo da forma de pagamento selecionada
                const selectedSummary = useRedemption
                  ? { icon: <Star className="w-5 h-5 fill-gold text-gold" />, label: "Corte Grátis", sub: "Benefício aplicado" }
                  : paymentMethod === 'pix'
                    ? { icon: <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />, label: "PIX", sub: "Confirmação instantânea" }
                    : paymentMethod === 'wallet'
                      ? { icon: <Wallet className="w-5 h-5 text-emerald-500" />, label: "Carteira", sub: `Saldo R$ ${walletBalance.toFixed(2).replace('.', ',')}` }
                      : { icon: <Landmark className="w-5 h-5 text-foreground" />, label: "Pagar na Barbearia", sub: "Presencial no dia do atendimento" };

                return (
                  <div className="mb-2">
                    <h3 className="text-[14px] font-semibold text-foreground mb-3">
                      Forma de pagamento
                    </h3>

                    <button
                      onClick={() => setPaymentSheetOpen(true)}
                      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left active:scale-[0.99] transition-transform"
                    >
                      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                        {selectedSummary.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-foreground leading-tight">{selectedSummary.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{selectedSummary.sub}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                    </button>

                    {/* Breakdown carteira quando selecionada */}
                    <AnimatePresence>
                      {walletIsSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-3.5 space-y-2.5">
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
                                  <span className="text-[13px] font-bold text-emerald-500 tabular-nums">R$ 0,00</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[11px] font-medium text-foreground/70">Pagar na barbearia</span>
                                  <span className="text-[13px] font-bold text-foreground tabular-nums">
                                    R$ {walletRemainder.toFixed(2).replace('.', ',')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>





                    {/* Sheet com todas as opções */}
                    <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
                      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto !bg-background from-background to-background" style={{ boxShadow: '0 -8px 32px hsl(var(--foreground) / 0.1)' }}>
                        <SheetHeader className="text-left mb-4">
                          <SheetTitle className="text-[16px] font-bold">Forma de pagamento</SheetTitle>
                        </SheetHeader>

                        <div className="space-y-2.5 pb-4">
                          {canUseRedemption && (
                            <PaymentOption
                              value="redemption"
                              selected={useRedemption}
                              onSelect={() => { setUseRedemption(true); setPaymentMethod('cash'); setPaymentSheetOpen(false); }}
                              title="Corte Grátis Disponível!"
                              description={useRedemption
                                ? "Parabéns! O valor do seu corte será totalmente descontado."
                                : "Toque para aplicar seu benefício. Se não usar agora, você perderá esta promoção."}
                              highlight={true}
                              icon={<Star className={cn("w-5 h-5", useRedemption ? "fill-gold text-gold" : "text-muted-foreground/40")} />}
                            />
                          )}

                          {canReceivePix && (
                            <PaymentOption
                              value="pix"
                              selected={paymentMethod === 'pix' && !useRedemption}
                              onSelect={() => { setPaymentMethod('pix'); setUseRedemption(false); setPaymentSheetOpen(false); }}
                              title="Pagar via PIX"
                              description="Confirmação instantânea e segura"
                              icon={<img src={pixIcon} alt="PIX" className={cn("w-5 h-5 object-contain", paymentMethod === 'pix' && !useRedemption ? "" : "grayscale opacity-50")} />}
                            />
                          )}

                          {canReceivePix && (
                            <PaymentOption
                              value="card"
                              selected={false}
                              onSelect={() => {}}
                              disabled={true}
                              title="Cartão de Crédito"
                              description="Pague em até 12x pelo App"
                              icon={<CreditCard className="w-5 h-5 text-muted-foreground/30" />}
                            />
                          )}

                          <PaymentOption
                            value="cash"
                            selected={paymentMethod === 'cash' && !useRedemption}
                            onSelect={() => { setPaymentMethod('cash'); setUseRedemption(false); setPaymentSheetOpen(false); }}
                            title="Pagar na Barbearia"
                            description="Pagamento presencial no dia"
                            icon={<Landmark className={cn("w-5 h-5", paymentMethod === 'cash' && !useRedemption ? "text-primary" : "text-muted-foreground/40")} />}
                          />

                          {canReceivePix && walletBalance > 0 && (
                            <PaymentOption
                              value="wallet"
                              selected={walletIsSelected}
                              onSelect={() => { setPaymentMethod('wallet'); setUseRedemption(false); setPaymentSheetOpen(false); }}
                              title="Pagar com Carteira"
                              description={`Saldo: R$ ${walletBalance.toFixed(2).replace('.', ',')}`}
                              icon={<Wallet className={cn("w-5 h-5", walletIsSelected ? "text-emerald-500" : "text-muted-foreground/40")} />}
                            />
                          )}
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                );
              })()}

              {/* Divider */}
              <div className="border-t border-border/40 my-5" />

              {/* Cupom */}
              <div className="mb-5">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Tag className="w-4 h-4 text-foreground" />
                      <div>
                        <span className="text-[14px] font-semibold text-foreground">{appliedCoupon.code}</span>
                        <span className="text-[11px] text-emerald-500 ml-2 font-medium">
                          {appliedCoupon.tipo_desconto === "percentual"
                            ? `-${appliedCoupon.valor_desconto}%`
                            : `-R$ ${appliedCoupon.valor_desconto.toFixed(2).replace(".", ",")}`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-[12px] text-primary hover:text-primary/80 font-medium"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Tag className="w-4 h-4 text-foreground" />
                      <span className="text-[14px] font-semibold text-foreground">Cupom</span>
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
                        className="text-right bg-transparent border-none outline-none text-[13px] text-primary placeholder:text-primary/70 font-medium uppercase tracking-wider w-44"
                      />
                      {validatingCoupon && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                          <div className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/40 my-5" />

              {/* Resumo de valores */}
              <div className="mb-5">
                <h3 className="text-[14px] font-semibold text-foreground mb-3">
                  Resumo de valores
                </h3>
                <div className="space-y-2.5">
                  {selectedServices.map((s) => {
                    const qty = serviceQuantities[s.id] || 1;
                    const lineTotal = s.preco * qty;
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-muted-foreground truncate">
                          {s.nome}{qty > 1 ? ` ×${qty}` : ""}
                        </span>
                        <span className="text-[13px] text-foreground tabular-nums flex-shrink-0">
                          R$ {lineTotal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    );
                  })}
                  {availableCredits > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground">Créditos do plano</span>
                      <span className="text-[13px] text-emerald-500 tabular-nums">
                        − R$ {Math.min(availableCredits, getTotalPrice()).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground">Taxa de serviço</span>
                    <span className="text-[13px] text-foreground tabular-nums">
                      R$ {getServiceFee(paymentMethod).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[15px] font-bold text-foreground">Total</span>
                    <span className="text-[15px] font-bold text-foreground tabular-nums">
                      R$ {(Math.max(0, getTotalPrice() - availableCredits) + getServiceFee(paymentMethod)).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
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
                      <span className="text-sm text-emerald-400 font-medium">
                        Cupom {appliedCoupon.code}
                        {appliedCoupon.tipo_desconto === "percentual"
                          ? ` (${appliedCoupon.valor_desconto}%)`
                          : ""}
                      </span>
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

            {/* Bar content - estilo Sacola: CTA único full-width */}
            <div className="bg-background border-t border-border/40 px-4 pb-safe">
              <div className="pt-3 pb-4">
                <motion.button
                  onClick={handleProceedFromPayment}
                  disabled={processingPayment}
                  whileTap={{ scale: processingPayment ? 1 : 0.985 }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2",
                    "h-[52px] rounded-xl",
                    "font-semibold text-[14px] text-primary-foreground",
                    "bg-primary",
                    "active:brightness-90 transition-all duration-150",
                    processingPayment && "opacity-70 cursor-wait"
                  )}
                  style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)" }}
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <span>
                      {paymentMethod === 'pix' ? 'Gerar PIX' :
                       paymentMethod === 'card' ? 'Pagar' :
                       paymentMethod === 'cash' ? 'Finalizar' :
                       'Revisar pedido'}
                      {' • '}
                      R$ {(Math.max(0, getTotalPrice() - availableCredits) + getServiceFee(paymentMethod)).toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diálogo: perder corte grátis ao seguir sem aplicar */}
      <Dialog open={showLoseRedemptionDialog} onOpenChange={setShowLoseRedemptionDialog}>
        <DialogContent className="max-w-[80vw] md:max-w-[340px] rounded-[32px] border border-white/20 bg-white/95 backdrop-blur-sm p-0 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] focus:outline-none [&>button]:hidden">
          <div className="p-7 text-center">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-[19px] font-bold text-zinc-900 tracking-tight leading-tight">
                Você tem um benefício pendente
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-relaxed text-zinc-600 px-1">
                Se você continuar sem selecionar o <span className="text-zinc-900 font-semibold">Corte Grátis</span>, você perderá essa promoção definitivamente. Deseja prosseguir mesmo assim?
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-8 flex flex-col gap-2">
              <Button
                disabled={consumingRedemption}
                onClick={(e) => { e.preventDefault(); handleConfirmLoseRedemption(); }}
                className="w-full h-[52px] rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[15px] transition-all border-none active:scale-[0.98]"
              >
                {consumingRedemption ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : "Sim, desejo perder"}
              </Button>
              
              <Button 
                disabled={consumingRedemption}
                onClick={() => setShowLoseRedemptionDialog(false)}
                className="w-full h-[52px] rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold text-[15px] border-none transition-all active:scale-[0.98]"
                variant="ghost"
              >
                Voltar e aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
