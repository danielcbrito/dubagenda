import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BackArrow } from "@/components/ui/back-arrow";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Clock, Check, Tag, CreditCard, Landmark, Loader2, Calendar as CalendarIcon, Shield, Zap, Star, Store, ChevronRight, Crown, Wallet } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";
import pixIcon from "@/assets/pix-icon.png";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { format, eachDayOfInterval, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { sendNovoAgendamentoEvent, sendRemarcacaoConcluidaEvent } from "@/lib/webhookService";
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

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
  tenant_id?: string | null;
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

  // Verificação se usuário pode usar o plano
  const isPlanEligible =
    !isRescheduling &&
    isPlanFlow &&
    !!activeSubscription?.servico &&
    (selectedServices?.length ?? 0) === 1 &&
    selectedServices?.[0]?.id === activeSubscription.servico.id &&
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
    refreshSlots,
    verifySlotAvailability 
  } = useSlotAvailability(
    selectedDate, 
    totalDuration,
    isRescheduling ? rescheduleAppointmentId : null,
    selectedBarberId,
    availabilityTenantId
  );

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

  // Carregar barbeiros (filtrado pelo tenant da barbearia preferida)
  const loadBarbers = async (tenantId?: string | null) => {
    let query = supabase
      .from("barbeiros")
      .select("id, apelido, foto_url, tenant_id")
      .eq("ativo", true)
      .order("apelido");

    if (tenantId) {
      // Filtra barbeiros da barbearia preferida
      query = query.eq("tenant_id", tenantId);
    } else {
      // Fluxo DUB exclusivo: barbeiros sem tenant (globais)
      query = query.is("tenant_id", null);
    }

    const { data } = await query;
    setBarbers(data || []);

    // Também carrega todos para "ver outras barbearias"
    const { data: all } = await supabase
      .from("barbeiros")
      .select("id, apelido, foto_url, tenant_id")
      .eq("ativo", true)
      .order("apelido");
    setAllBarbers(all || []);
  };

  // Initialize booking
  useEffect(() => {
    const initializeBooking = async () => {
      setIsInitializing(true);

      // Carregar barbearia preferida do perfil
      const { data: { session } } = await supabase.auth.getSession();
      let tenantId: string | null = null;
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("barbearia_preferida_id")
          .eq("id", session.user.id)
          .single();

        if (profile?.barbearia_preferida_id) {
          tenantId = profile.barbearia_preferida_id;
          // Buscar nome da barbearia
          const { data: tenant } = await supabase
            .from("tenants")
            .select("id, nome")
            .eq("id", tenantId)
            .single();
          if (tenant) setPreferredShop(tenant);
        }
      }

      await loadBarbers(tenantId);
      await loadUserCredits();
      await loadAvailableRedemptions();

      // Auto-select barber from query param (e.g., after subscription)
      const barberFromParam = searchParams.get("barber");
      if (barberFromParam) {
        const barbersList = (await supabase.from("barbeiros").select("id, apelido, foto_url, tenant_id").eq("ativo", true).order("apelido")).data || [];
        const matchedBarber = barbersList.find((b: Barber) => b.id === barberFromParam);
        if (matchedBarber) {
          setSelectedBarber(matchedBarber);
          await loadBarberCustomDurations(matchedBarber.id);
          // Remove param from URL
          setSearchParams(prev => {
            prev.delete("barber");
            return prev;
          }, { replace: true });
        }
      }

      // Verificar se deve retomar direto para a etapa de pagamento (PIX expirado)
      const resumePaymentRaw = sessionStorage.getItem("resumeToPaymentStep");
      if (resumePaymentRaw) {
        sessionStorage.removeItem("resumeToPaymentStep");
        try {
          const resumeData = JSON.parse(resumePaymentRaw);
          await loadServices(tenantId);

          // Pré-selecionar barbeiro (filtrado pelo tenant)
          await loadBarbers(tenantId);
          const resumeBarber = barbers.find((b: Barber) => b.id === resumeData.barberId) 
            || (await supabase.from("barbeiros").select("id, apelido, foto_url").eq("id", resumeData.barberId).maybeSingle()).data;
          if (resumeBarber) {
            setSelectedBarber(resumeBarber);
            await loadBarberCustomDurations(resumeBarber.id);
          }

          // Pré-selecionar serviço (já carregado com tenant filter acima)
          const resumeService = services.find((s: Service) => s.id === resumeData.servicoId)
            || (await supabase.from("servicos").select("*").eq("id", resumeData.servicoId).maybeSingle()).data;
          if (resumeService) setSelectedServices([resumeService]);

          // Pré-selecionar data e hora
          if (resumeData.date) setSelectedDate(new Date(`${resumeData.date}T12:00:00`));
          if (resumeData.time) setSelectedTime(resumeData.time);

          // Ir direto para o step 5 (pagamento)
          setStep(5);
          setIsInitializing(false);
          return;
        } catch (e) {
          console.error("Erro ao restaurar dados de pagamento:", e);
        }
      }

      const isReschedulingSession = sessionStorage.getItem('isRescheduling');
      const appointmentId = sessionStorage.getItem('rescheduleAppointmentId');

      if (isReschedulingSession === 'true' && appointmentId) {
        setIsRescheduling(true);
        setRescheduleAppointmentId(appointmentId);
        loadAppointmentForReschedule(appointmentId);
        setIsInitializing(false);
        return;
      }

      const subscription = await loadActiveSubscription();

      if (subscription) {
        const restantes = subscription.limite_agendamentos_mes - subscription.agendamentos_usados;

        if (restantes > 0) {
          // SEMPRE ativar isPlanFlow para assinantes
          setIsPlanFlow(true);

          // Auto-selecionar barbeiro do plano
          if (subscription.barbeiro) {
            setSelectedBarber(subscription.barbeiro);
            await loadBarberCustomDurations(subscription.barbeiro.id);
          }

          if (subscription.servico) {
            // Plano COM serviço vinculado: pula direto para data
            setSelectedServices([subscription.servico]);
            setStep(subscription.barbeiro ? 2 : 1); // 2=data, 1=barbeiro
          } else {
            // Plano SEM serviço vinculado: tentar auto-selecionar
            let barberTenantId = tenantId;
            if (subscription.barbeiro_id) {
              const { data: barberData } = await supabase
                .from("barbeiros")
                .select("tenant_id")
                .eq("id", subscription.barbeiro_id)
                .maybeSingle();
              barberTenantId = barberData?.tenant_id || tenantId;
            }
            
            // Buscar serviços do tenant
            let svcQuery = supabase.from("servicos").select("*").eq("ativo", true).order("preco");
            if (barberTenantId) {
              svcQuery = svcQuery.eq("tenant_id", barberTenantId);
            } else {
              svcQuery = svcQuery.is("tenant_id", null);
            }
            const { data: tenantServices } = await svcQuery;
            
            if (tenantServices && tenantServices.length === 1) {
              // Apenas 1 serviço: auto-selecionar e pular para data
              setSelectedServices([tenantServices[0]]);
              setServices(tenantServices);
              setStep(subscription.barbeiro ? 2 : 1);
            } else {
              // Múltiplos serviços: mostrar seleção
              setServices(tenantServices || []);
              setStep(subscription.barbeiro ? 2 : 1);
            }
          }
          setIsInitializing(false);
          return;
        }

        // Limite atingido - bloquear fluxo
        setSubscriptionLimitReached(true);
        setIsInitializing(false);
        return;
      }

      await loadServices(tenantId);
      setIsInitializing(false);
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

    const { data } = await query;
    setServices(data || []);
  };

  const loadUserCredits = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setUserId(session.user.id);

      const { data: creditsData, error } = await supabase
        .rpc("get_user_available_credits", { p_user_id: session.user.id });

      if (error) throw error;
      setAvailableCredits(creditsData || 0);

      // Fetch wallet balance
      const { data: walletData } = await supabase.functions.invoke('wallet-operations', {
        body: { action: 'get_balance' }
      });
      setWalletBalance(walletData?.balance || 0);
    } catch (error) {
      console.error("Error loading credits:", error);
    }
  };

  const loadAvailableRedemptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Verificar se já existe agendamento ativo usando resgate (anti-fraude)
      const { data: activeResgateAppointments } = await supabase
        .from("agendamentos")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("payment_method", "resgate")
        .in("status", ["pending", "confirmed", "completed"])
        .limit(1);

      // Se já tem agendamento ativo com resgate, bloquear novos resgates
      if (activeResgateAppointments && activeResgateAppointments.length > 0) {
        setAvailableRedemptions([]);
        return;
      }

      const { data: redemptions, error } = await supabase
        .from("resgates")
        .select("id, promocao_id")
        .eq("user_id", session.user.id)
        .eq("status", "available")
        .is("used_at", null);

      if (error) throw error;
      setAvailableRedemptions(redemptions || []);
    } catch (error) {
      console.error("Error loading redemptions:", error);
    }
  };

  const loadActiveSubscription = async (): Promise<ActiveSubscription | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data: subscription, error } = await supabase
        .from("assinaturas")
        .select(`
          id,
          plano_id,
          next_billing_date,
          status,
          barbeiro_id,
          plano:planos(nome, limite_agendamentos_mes, servico_id)
        `)
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (error) return null;

      if (subscription && subscription.plano) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const billingDate = new Date(subscription.next_billing_date + 'T12:00:00');
        billingDate.setHours(0, 0, 0, 0);
        
        const isOverdue = today > billingDate;

        if (isOverdue) {
          setSubscriptionBlocked(true);
          toast.error("Seu plano está vencido. Regularize o pagamento para continuar agendando.");
          return null;
        }

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const { data: monthAppointments, error: countError } = await supabase
          .from("agendamentos")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("tipo_agendamento", "plano")
          .gte("data", format(startOfMonth, 'yyyy-MM-dd'))
          .lte("data", format(endOfMonth, 'yyyy-MM-dd'))
          .not("status", "in", "('cancelled_by_user','cancelled_by_admin')");

        const usedCount = countError ? 0 : (monthAppointments?.length || 0);
        const planoData = subscription.plano as any;

        let servicoVinculado: Service | null = null;
        if (planoData.servico_id) {
          const { data: servicoData } = await supabase
            .from("servicos")
            .select("id, nome, descricao, duracao_minutos, preco")
            .eq("id", planoData.servico_id)
            .single();
          
          if (servicoData) {
            servicoVinculado = servicoData;
          }
        }

        // Buscar barbeiro vinculado ao plano
        let barbeiroVinculado: Barber | null = null;
        if (subscription.barbeiro_id) {
          const { data: barbeiroData } = await supabase
            .from("barbeiros")
            .select("id, apelido, foto_url")
            .eq("id", subscription.barbeiro_id)
            .single();
          
          if (barbeiroData) {
            barbeiroVinculado = barbeiroData;
          }
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
          servico: servicoVinculado,
          barbeiro_id: subscription.barbeiro_id || null,
          barbeiro: barbeiroVinculado,
        };

        setActiveSubscription(activeSubscriptionData);
        return activeSubscriptionData;
      }
      
      return null;
    } catch (error) {
      console.error("Error loading active subscription:", error);
      return null;
    }
  };

  const loadAppointmentForReschedule = async (appointmentId: string) => {
    try {
      const { data: appointment, error } = await supabase
        .from("agendamentos")
        .select(`*, servico:servicos(*), barbeiro:barbeiros(id, apelido, foto_url)`)
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
      setStep(2);
      toast.info("Escolha a nova data e horário");
    } catch (error) {
      console.error("Error loading appointment for reschedule:", error);
      toast.error("Erro ao carregar agendamento");
      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');
    }
  };

  const toggleService = (service: Service) => {
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
    try {
      const barbeiroId = selectedBarberId || null;
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

      let weeklyClosedDays: number[] = [];

      if (barbeiroId) {
        const { data: barbeiroConfig } = await supabase
          .from('configuracoes_horario_barbeiro')
          .select('dia_semana, aberto')
          .eq('barbeiro_id', barbeiroId);

        if (barbeiroConfig && barbeiroConfig.length > 0) {
          weeklyClosedDays = barbeiroConfig
            .filter(c => c.aberto === false)
            .map(c => c.dia_semana);
        } else {
          const { data: globalConfig } = await supabase
            .from('configuracoes_horario')
            .select('dia_semana, aberto');
          weeklyClosedDays = (globalConfig || [])
            .filter(c => !c.aberto)
            .map(c => c.dia_semana);
        }
      } else {
        const { data: globalConfig } = await supabase
          .from('configuracoes_horario')
          .select('dia_semana, aberto');
        weeklyClosedDays = (globalConfig || [])
          .filter(c => !c.aberto)
          .map(c => c.dia_semana);
      }

      const exceptionMap: Record<string, boolean> = {};

      const { data: globalExceptions } = await supabase
        .from('horarios_excepcionais')
        .select('data, aberto')
        .gte('data', startStr)
        .lte('data', endStr);

      for (const exc of globalExceptions || []) {
        exceptionMap[exc.data] = exc.aberto;
      }

      if (barbeiroId) {
        const { data: barbeiroExceptions } = await supabase
          .from('horarios_excepcionais_barbeiro')
          .select('data, aberto')
          .eq('barbeiro_id', barbeiroId)
          .gte('data', startStr)
          .lte('data', endStr);

        for (const exc of barbeiroExceptions || []) {
          exceptionMap[exc.data] = exc.aberto ?? true;
        }
      }

      const closed: Date[] = [];
      for (const day of allDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);

        if (dateStr in exceptionMap) {
          if (!exceptionMap[dateStr]) {
            closed.push(day);
          }
        } else if (weeklyClosedDays.includes(dayOfWeek)) {
          closed.push(day);
        }
      }

      setClosedDates(closed);
    } catch (error) {
      console.error('[loadClosedDates] Erro:', error);
    }
  }, [selectedBarberId]);

  const incrementServiceQty = (serviceId: string) => {
    setServiceQuantities(q => ({
      ...q,
      [serviceId]: Math.min((q[serviceId] || 1) + 1, 5)
    }));
  };

  const decrementServiceQty = (service: Service) => {
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
    // NOVO FLUXO (Step 1 = Barbeiro para TODOS):
    // Plano/Remarcação: 1=Barbeiro, 2=Data, 3=Horário, 4=Confirmação
    // Normal: 1=Barbeiro, 2=Serviços, 3=Data, 4=Horário, 5=Pagamento, 6=Confirmação
    
    // Step 1: Validar barbeiro
    if (step === 1 && !selectedBarberId) {
      toast.error("Selecione um profissional");
      return;
    }
    
    // Plano SEM serviço: step 2 = serviço
    const _planNeedsService = isPlanFlow && !activeSubscription?.servico;
    
    // Step 2: Serviços (não-plano normal OU plano sem serviço vinculado)
    const serviceStep = _planNeedsService ? 2 : (!isPlanFlow && !isRescheduling ? 2 : -1);
    if (step === serviceStep && selectedServices.length === 0) {
      toast.error("Selecione pelo menos um serviço");
      return;
    }
    
    // Validação de data
    const dateStep = _planNeedsService ? 3 : isPlanFlow ? 2 : isRescheduling ? 2 : 3;
    if (step === dateStep && !selectedDate) {
      toast.error("Selecione uma data");
      return;
    }
    
    // Validação de horário
    const timeStep = _planNeedsService ? 4 : isPlanFlow ? 3 : isRescheduling ? 3 : 4;
    if (step === timeStep && !selectedTime) {
      toast.error("Selecione um horário");
      return;
    }
    
    // Verificar disponibilidade antes de avançar da etapa de horário
    if (step === timeStep && selectedDate && selectedTime) {
      setLoading(true);
      try {
        const result = await verifySlotAvailability(selectedTime);
        
        if (!result.available) {
          toast.error(result.message || "Este horário acabou de ser reservado. Por favor, escolha outro.");
          refreshSlots();
          setSelectedTime("");
          setLoading(false);
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('[handleNextStep] Erro:', err);
        setLoading(false);
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }
    }
    
    // Remarcação: após horário (step 3), vai para confirmação (step 4)
    if (isRescheduling && step === 3) {
      setStep(4);
      return;
    }
    
    // Fluxo de plano COM serviço: após horário (step 3), vai para confirmação (step 4)
    if (isPlanFlow && !_planNeedsService && step === 3) {
      setStep(4);
      return;
    }
    
    // Fluxo de plano SEM serviço: após horário (step 4), vai para confirmação (step 5)
    if (isPlanFlow && _planNeedsService && step === 4) {
      setStep(5);
      return;
    }

    // Fluxo normal: após horário (step 4), verifica créditos
    if (!isPlanFlow && !isRescheduling && step === 4) {
      const totalPrice = getTotalPrice();
      if (availableCredits >= totalPrice) {
        setPaymentMethod('cash');
        setStep(6); // Vai direto para confirmação final
        return;
      }
      // Senão vai para pagamento (step 5)
    }
    
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

      const mainService = selectedServices[0];
      const bookingData = {
        servico_id: mainService.id,
        barbeiro_id: selectedBarberId || null,
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora: selectedTime,
        duracao: totalDuration,
        preco: finalPrice,
        serviceName: serviceNames,
        observacoes: selectedServices.length > 1 
          ? `Serviços: ${serviceNames}` 
          : undefined,
      };

      // === PIX via Asaas (QR Code inline) ===
      if (paymentMethod === 'pix') {
        const { data, error } = await supabase.functions.invoke('create-asaas-pix', {
          body: {
            bookingData,
            rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.pixQrCode && data?.pixPayload) {
          // Enriquecer dados com informações do agendamento para a tela de checkout
          const enrichedData = {
            ...data,
            serviceName: serviceNames,
            barberName: selectedBarber?.apelido || "Profissional",
            bookingDate: format(selectedDate, "dd/MM/yyyy"),
            bookingTime: selectedTime,
          };
          sessionStorage.setItem('pix_checkout_data', JSON.stringify(enrichedData));
          navigate('/cliente/pix-checkout');
          return;
        }
        throw new Error("Não foi possível gerar o QR Code PIX.");
      }

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

      // === Pagamento via Carteira (wallet) ===
      if (paymentMethod === 'wallet') {
        // Create appointment first via create-payment (cash mode)
        const payload: any = {
          bookingData,
          metodo: 'wallet',
          creditsUsed: 0,
          rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
        };

        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: payload,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Debit wallet
        const { data: walletResult, error: walletError } = await supabase.functions.invoke('wallet-operations', {
          body: {
            action: 'pay_service',
            amount: finalPrice,
            appointmentId: data.appointmentId,
          },
        });

        if (walletError || walletResult?.error) {
          throw new Error(walletResult?.error || "Erro ao debitar carteira");
        }

        if (appliedCoupon && data.appointmentId) {
          await registerCouponUsage(data.appointmentId);
        }

        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');

        const { data: profile } = await supabase.from('profiles').select('nome, telefone').eq('id', session.user.id).single();
        sendNovoAgendamentoEvent({
          agendamento_id: data.appointmentId || '',
          cliente_id: session.user.id,
          cliente_nome: profile?.nome || session.user.email || 'Cliente',
          cliente_telefone: profile?.telefone,
          servico: serviceNames,
          data: format(selectedDate, 'yyyy-MM-dd'),
          hora: selectedTime,
          preco: finalPrice
        });

        toast.success("Agendamento criado! Pagamento debitado da carteira.");
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
      
      const { data: profile } = await supabase.from('profiles').select('nome, telefone').eq('id', session.user.id).single();
      sendNovoAgendamentoEvent({
        agendamento_id: data.appointmentId || '',
        cliente_id: session.user.id,
        cliente_nome: profile?.nome || session.user.email || 'Cliente',
        cliente_telefone: profile?.telefone,
        servico: serviceNames,
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora: selectedTime,
        preco: finalPrice
      });
      
      toast.success("Agendamento criado! Pague na barbearia.");
      navigate("/cliente");
    } catch (error: any) {
      console.error('Payment error:', error);
      
      if (error.message?.includes('TIME_SLOT_UNAVAILABLE') || error.message?.includes('indisponível') || error.message?.includes('Horário')) {
        toast.error(error.message || "Horário indisponível. Escolha outro horário.");
        setStep(3);
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

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: { data: dateStr, hora: selectedTime, duracao: totalDuration, userId: session.user.id, barberId: selectedBarberId }
      });

      if (validationError || !validation?.valid) {
        toast.error(validation?.message || "Horário indisponível. Escolha outro.");
        setStep(3);
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
          hora: selectedTime,
          duracao: totalDuration,
          preco: 0,
          status: "pending",
          observacoes: `Corte grátis - Resgate do programa de fidelidade. ${selectedServices.length > 1 ? 'Serviços: ' + serviceNames : ''}`,
          payment_method: 'resgate',
          is_free: true,
          barbeiro_confirmou: false,
          cliente_confirmou: false,
        })
        .select()
        .single();

      if (aptError) throw aptError;

      await markRedemptionAsUsed(appointment.id);

      const { data: profile } = await supabase.from('profiles').select('nome, telefone').eq('id', session.user.id).single();
      sendNovoAgendamentoEvent({
        agendamento_id: appointment.id,
        cliente_id: session.user.id,
        cliente_nome: profile?.nome || 'Cliente',
        cliente_telefone: profile?.telefone,
        servico: serviceNames,
        data: dateStr,
        hora: selectedTime,
        preco: 0
      });

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

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
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

      if (!validation?.valid) {
        toast.error(validation?.message || "Horário indisponível. Escolha outro horário.");
        setStep(3);
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
          hora: selectedTime,
          duracao: totalDuration,
          preco: 0,
          status: "pending",
          observacoes: observacoesText,
          payment_method: 'credit',
          is_free: true,
          remarcado_de: isRescheduling ? rescheduleAppointmentId : null,
          barbeiro_confirmou: false,
          cliente_confirmou: false,
        })
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

      const { data: profile } = await supabase.from('profiles').select('nome, telefone').eq('id', session.user.id).single();
      sendNovoAgendamentoEvent({
        agendamento_id: appointment.id,
        cliente_id: session.user.id,
        cliente_nome: profile?.nome || session.user.email || 'Cliente',
        cliente_telefone: profile?.telefone,
        servico: serviceNames,
        data: dateStr,
        hora: selectedTime,
        preco: 0
      });

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

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id,
          barberId: selectedBarberId
        }
      });

      if (validationError) {
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }

      if (!validation?.valid) {
        toast.error(validation?.message || "Horário indisponível. Escolha outro horário.");
        setStep(3);
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
          hora: selectedTime,
          duracao: totalDuration,
          preco: 0,
          status: "pending",
          observacoes: `Agendamento via ${activeSubscription.plano_nome}. ${selectedServices.length > 1 ? 'Serviços: ' + serviceNames : ''}`,
          payment_method: 'plano',
          tipo_agendamento: 'plano',
          is_free: true,
          barbeiro_confirmou: false,
          cliente_confirmou: false,
        })
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

      const { data: profile } = await supabase.from('profiles').select('nome, telefone').eq('id', session.user.id).single();
      sendNovoAgendamentoEvent({
        agendamento_id: appointment.id,
        cliente_id: session.user.id,
        cliente_nome: profile?.nome || session.user.email || 'Cliente',
        cliente_telefone: profile?.telefone,
        servico: serviceNames,
        data: dateStr,
        hora: selectedTime,
        preco: 0
      });

      toast.success(`Agendamento criado! Usando seu ${activeSubscription.plano_nome}.`);
      navigate("/cliente");
    } catch (error: any) {
      console.error('Error creating appointment with plan:', error);
      toast.error("Erro ao criar agendamento: " + (error.message || "Erro desconhecido"));
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
      
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
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

      if (!validation?.valid) {
        toast.error(validation?.message || "Horário indisponível. Escolha outro horário.");
        setStep(3);
        refreshSlots();
        return;
      }
      
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          status: 'pending',
          barbeiro_confirmou: false,
          cliente_confirmou: false,
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
    // Step 1 (Barbeiro) - volta para home
    if (step === 1) {
      navigate("/cliente");
      return;
    }
    
    // Assinante com barbeiro pré-selecionado (com ou sem isPlanFlow): step 2 = primeira etapa visível
    if (activeSubscription?.barbeiro && step === 2) {
      navigate("/cliente");
      return;
    }

    if (isPlanFlow && activeSubscription?.barbeiro) {
      setStep(step - 1);
    } else if (isPlanFlow) {
      setStep(step - 1);
    } else if (isRescheduling) {
      setStep(step - 1);
    } else {
      setStep(step - 1);
    }
  };

  // Plano SEM serviço vinculado: precisa de seleção de serviço adicional
  const planNeedsService = isPlanFlow && !activeSubscription?.servico;
  
  // Cálculo de steps por fluxo:
  // Plano COM serviço + barbeiro: 3 etapas (Data, Horário, Confirmação)
  // Plano SEM serviço + barbeiro: 4 etapas (Serviço, Data, Horário, Confirmação)
  // Plano sem barbeiro: +1 (Barbeiro primeiro)
  // Remarcação: 4 etapas (Barbeiro, Data, Horário, Confirmação)
  // Normal: 6 etapas (Barbeiro, Serviços, Data, Horário, Pagamento, Confirmação)
  const totalSteps = isPlanFlow && activeSubscription?.barbeiro 
    ? (planNeedsService ? 4 : 3) 
    : isPlanFlow ? (planNeedsService ? 5 : 4) 
    : isRescheduling ? 4 : 6;
  
  // Ajustar step visual para plano com barbeiro auto-selecionado
  const currentDisplayStep = isPlanFlow && activeSubscription?.barbeiro 
    ? Math.min(step - 1, totalSteps) 
    : Math.min(step, totalSteps);

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  // Loading gate — previne flash do step 1 enquanto inicializa
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
            Limite Mensal Atingido
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Você já utilizou todos os {activeSubscription?.limite_agendamentos_mes || 4} agendamentos 
            do seu plano <span className="text-primary font-semibold">{activeSubscription?.plano_nome}</span> este mês.
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
              {/* Barbershop context header */}
              {preferredShop ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 pt-1"
                >
                  <div className="rounded-xl border border-border/40 bg-card dark:bg-card/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
                        <Store className="w-[18px] h-[18px] text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-0.5">Agendando em</p>
                        <p className="text-[14px] font-bold text-foreground truncate leading-tight">{preferredShop.nome}</p>
                      </div>
                      <div className="flex items-center gap-1 bg-emerald-500/10 dark:bg-emerald-500/15 px-2 py-1 rounded-lg flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Ativa</span>
                      </div>
                    </div>
                    <div className="border-t border-border/30 px-4 py-2.5 flex items-center justify-between">
                      <button
                        onClick={() => navigate("/escolher-barbearia")}
                        className="text-[11px] text-primary font-semibold flex items-center gap-1.5 active:opacity-70 transition-opacity"
                      >
                        <Store className="w-3 h-3" />
                        Trocar barbearia
                      </button>
                      <button
                        onClick={() => {
                          setShowingOtherShops(!showingOtherShops);
                          if (!showingOtherShops) {
                            setBarbers(allBarbers);
                          } else {
                            setBarbers(allBarbers.filter(b => (b as any).tenant_id === preferredShop.id));
                          }
                        }}
                        className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {showingOtherShops ? "Só desta" : "Todos profissionais"}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* DUB Exclusive header */
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 pt-1"
                >
                  <div className="rounded-xl border border-primary/25 bg-card dark:bg-card/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center border border-primary/20 overflow-hidden flex-shrink-0 shadow-sm">
                        <img src={logoDub} alt="DUB" className="w-7 h-7 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-0.5">Agendando em</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-bold text-foreground leading-tight">Barbearia DUB</p>
                          <Crown className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Exclusivo</span>
                      </div>
                    </div>
                    <div className="border-t border-border/30 px-4 py-2.5">
                      <button
                        onClick={() => navigate("/escolher-barbearia")}
                        className="text-[11px] text-primary font-semibold flex items-center gap-1.5 active:opacity-70 transition-opacity"
                      >
                        <Store className="w-3 h-3" />
                        Trocar barbearia
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Seu Profissional
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  {showingOtherShops ? "Profissionais de todas as barbearias" : "Quem vai cuidar de você hoje?"}
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
                    />
                  ))}
                </div>
              )}

            </div>

            <FloatingActionBar
              isVisible={!!selectedBarber}
              onContinue={() => setStep(2)}
              label={`Continuar`}
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

        {/* Step 2: Serviços (usuários SEM plano OU plano SEM serviço vinculado) */}
        {step === 2 && ((!isPlanFlow && !isRescheduling) || planNeedsService) && (
          <motion.div
            key="step-2-services"
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
                  O que deseja?
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  Selecione um ou mais serviços
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
                  />
                ))}
              </div>

              {/* Premium Bottom Bar */}
              <BookingBottomBar
                serviceCount={selectedServices.reduce((sum, s) => sum + (serviceQuantities[s.id] || 1), 0)}
                totalDuration={getTotalDuration()}
                totalPrice={getTotalPrice()}
                onContinue={() => setStep(3)}
                isVisible={selectedServices.length > 0}
              />
            </div>
          </motion.div>
        )}

        {/* Data: Step 2 (Plano com serviço/Remarcação), Step 3 (Plano sem serviço/Normal) */}
        {(((isPlanFlow && !planNeedsService) && step === 2) || (planNeedsService && step === 3) || (isRescheduling && step === 2) || (!isPlanFlow && !isRescheduling && step === 3)) && (
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
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Melhor dia pra você
                </h2>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  {isPlanFlow && activeSubscription ? (
                    <>{activeSubscription.servico?.nome || getFormattedServiceNames()} • {selectedBarber?.apelido}</>
                  ) : selectedBarber ? (
                    <>com {selectedBarber.apelido}</>
                  ) : (
                    "Selecione o dia desejado"
                  )}
                </p>
              </div>

              <PremiumCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                closedDates={closedDates}
                onMonthChange={loadClosedDates}
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

        {/* Horário: Step 3 (Plano com serviço/Remarcação), Step 4 (Plano sem serviço/Normal) */}
        {(((isPlanFlow && !planNeedsService) && step === 3) || (planNeedsService && step === 4) || (isRescheduling && step === 3) || (!isPlanFlow && !isRescheduling && step === 4)) && (
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
                  <p className="text-muted-foreground font-medium mb-4">
                    {selectedBarber?.apelido} está com agenda cheia neste dia.
                  </p>
                  <button
                    onClick={() => setStep(planNeedsService ? 3 : isPlanFlow ? 2 : isRescheduling ? 2 : 3)}
                    className="px-6 py-3 border border-border rounded-xl text-foreground hover:bg-secondary transition-all"
                  >
                    Escolher outra data
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {availableSlots.map((slot) => (
                      <TimeSlot
                        key={slot.time}
                        time={slot.time}
                        isSelected={selectedTime === slot.time}
                        isDisabled={!slot.available}
                        onSelect={() => {
                          if (slot.available) {
                            setSelectedTime(slot.time);
                            setUnavailableMessage(null);
                          } else {
                            if (slot.blockedReason === 'minimum_advance') {
                              setUnavailableMessage("É necessário 30 minutos de antecedência.");
                            } else {
                              setUnavailableMessage("Este horário já foi agendado.");
                            }
                          }
                        }}
                      />
                    ))}
                  </div>

                  {unavailableMessage && (
                    <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
                      <p className="text-sm text-destructive font-medium">{unavailableMessage}</p>
                    </div>
                  )}

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
                      {getTotalDuration()} min • {selectedBarber?.apelido} • {selectedDate ? format(selectedDate, "dd/MM", { locale: ptBR }) : ""} às {selectedTime}
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

              {/* Métodos de pagamento digital - temporariamente ocultos */}
              {/* PIX e Cartão removidos temporariamente */}

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
              {walletBalance > 0 && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setPaymentMethod('wallet'); setUseRedemption(false); }}
                  disabled={walletBalance < getTotalPrice()}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all mt-3",
                    walletBalance < getTotalPrice() && "opacity-50 cursor-not-allowed",
                    paymentMethod === 'wallet' && !useRedemption
                      ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : "border-border/20 bg-card/50 hover:border-border/40"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      paymentMethod === 'wallet' && !useRedemption ? "bg-emerald-500/10" : "bg-muted/20"
                    )}>
                      <Wallet className={cn(
                        "w-5 h-5 transition-colors",
                        paymentMethod === 'wallet' && !useRedemption ? "text-emerald-500" : "text-muted-foreground/30"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground/70">Pagar com Carteira</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        {walletBalance >= getTotalPrice() 
                          ? `Saldo: R$ ${walletBalance.toFixed(2).replace('.', ',')}`
                          : `Saldo insuficiente: R$ ${walletBalance.toFixed(2).replace('.', ',')}`
                        }
                      </p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      paymentMethod === 'wallet' && !useRedemption
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-muted-foreground/20"
                    )}>
                      {paymentMethod === 'wallet' && !useRedemption && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                </motion.button>
              )}

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

        {/* Confirmação Plano: Step 4 (com serviço) ou Step 5 (sem serviço) */}
        {isPlanFlow && ((planNeedsService && step === 5) || (!planNeedsService && step === 4)) && (
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
                  value={selectedTime}
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
                  <span className="text-sm text-muted-foreground">Agendamentos este mês</span>
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
                  value={selectedTime}
                />
                
                <div className="border-t border-border" />
                
                <SummaryRow 
                  label="Forma de Pagamento"
                  value={
                    useRedemption && getTotalPrice() === 0 ? "Resgate de Fidelidade" :
                    paymentMethod === 'wallet' ? "Carteira do App" :
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

        {/* Step 4: Confirmação Remarcação */}
        {step === 4 && isRescheduling && (
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
                  value={selectedTime}
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
