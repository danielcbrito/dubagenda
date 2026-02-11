import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, Check, Copy, Shield, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { sendNovoAgendamentoEvent, sendRemarcacaoConcluidaEvent } from "@/lib/webhookService";
import { motion, AnimatePresence } from "framer-motion";
import pixIcon from "@/assets/pix-icon.png";

// Premium Components
import { ServiceCard } from "@/components/booking/ServiceCard";
import { BarberCard } from "@/components/booking/BarberCard";
import { TimeSlot } from "@/components/booking/TimeSlot";
import { PaymentOption } from "@/components/booking/PaymentOption";
import { SummaryRow } from "@/components/booking/SummaryRow";
import { PremiumCalendar } from "@/components/booking/PremiumCalendar";
import { StepDots } from "@/components/booking/StepDots";
import { BookingBottomBar } from "@/components/booking/BookingBottomBar";
import { TimeSelectionBar } from "@/components/booking/TimeSelectionBar";

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
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
}

const ClienteAgendar = () => {
  const navigate = useNavigate();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash'>('pix');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState<string | null>(null);
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCep, setCardCep] = useState("");
  const [resumePendingBookingId, setResumePendingBookingId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [pixExpiresAt, setPixExpiresAt] = useState<string | null>(null);
  const [pixExpired, setPixExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [regeneratingPix, setRegeneratingPix] = useState(false);
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
  const [copied, setCopied] = useState(false);
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  
  // Indica se o usuário está usando fluxo de plano (serviço pré-selecionado)
  const [isPlanFlow, setIsPlanFlow] = useState(false);

  // Verificação se usuário pode usar o plano
  const isPlanEligible =
    !isRescheduling &&
    isPlanFlow &&
    !!activeSubscription?.servico &&
    (selectedServices?.length ?? 0) === 1 &&
    selectedServices?.[0]?.id === activeSubscription.servico.id &&
    activeSubscription.agendamentos_usados < activeSubscription.limite_agendamentos_mes;

  const totalDuration = (selectedServices || []).reduce((sum, s) => sum + s.duracao_minutos * (serviceQuantities[s.id] || 1), 0);

  const { 
    slots: availableSlots, 
    loading: loadingSlots, 
    refreshSlots,
    verifySlotAvailability 
  } = useSlotAvailability(
    selectedDate, 
    totalDuration,
    isRescheduling ? rescheduleAppointmentId : null,
    selectedBarber?.id || null
  );

  // Carregar barbeiros
  const loadBarbers = async () => {
    const { data } = await supabase
      .from("barbeiros")
      .select("id, apelido, foto_url")
      .eq("ativo", true)
      .order("apelido");
    setBarbers(data || []);
  };

  // Initialize booking
  useEffect(() => {
    const initializeBooking = async () => {
      await loadBarbers();
      await loadUserCredits();
      await loadAvailableRedemptions();

      const resumeBookingId = sessionStorage.getItem('resumePendingBookingId');
      if (resumeBookingId) {
        setResumePendingBookingId(resumeBookingId);
        sessionStorage.removeItem('resumePendingBookingId');
        loadPendingBookingDetails(resumeBookingId);
        return;
      }

      const isReschedulingSession = sessionStorage.getItem('isRescheduling');
      const appointmentId = sessionStorage.getItem('rescheduleAppointmentId');

      if (isReschedulingSession === 'true' && appointmentId) {
        setIsRescheduling(true);
        setRescheduleAppointmentId(appointmentId);
        loadAppointmentForReschedule(appointmentId);
        return;
      }

      const subscription = await loadActiveSubscription();

      if (subscription?.servico) {
        const restantes = subscription.limite_agendamentos_mes - subscription.agendamentos_usados;

        if (restantes > 0) {
          // Usuário de plano com agendamentos disponíveis
          setSelectedServices([subscription.servico]);
          setIsPlanFlow(true);
          setStep(1); // Step 1 = Escolher barbeiro (para todos)
          return;
        }

        // Limite atingido - bloquear fluxo
        setSubscriptionLimitReached(true);
        return;
      }

      await loadServices();
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

  // Poll for payment confirmation
  useEffect(() => {
    if (step === 7 && pixQrCode && pendingBookingId && !paymentConfirmed) {
      const pollInterval = setInterval(async () => {
        try {
          const { data: pendingBooking, error } = await supabase
            .from("pending_bookings")
            .select("id")
            .eq("id", pendingBookingId)
            .maybeSingle();

          if (error) return;

          if (!pendingBooking) {
            setPaymentConfirmed(true);
            clearInterval(pollInterval);
            toast.success("Pagamento confirmado!");
            setTimeout(() => navigate("/cliente"), 4000);
          }
        } catch (error) {
          console.error("Error polling payment status:", error);
        }
      }, 3000);

      return () => clearInterval(pollInterval);
    }
  }, [step, pixQrCode, pendingBookingId, paymentConfirmed, navigate]);

  // Countdown timer for PIX expiration
  useEffect(() => {
    if (step !== 7 || !pixExpiresAt || pixExpired || paymentConfirmed) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiry = new Date(pixExpiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setPixExpired(true);
        setTimeRemaining("00:00");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [step, pixExpiresAt, pixExpired, paymentConfirmed]);

  const loadServices = async () => {
    const { data } = await supabase
      .from("servicos")
      .select("*")
      .eq("ativo", true)
      .order("preco");
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
    } catch (error) {
      console.error("Error loading credits:", error);
    }
  };

  const loadAvailableRedemptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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

        const activeSubscriptionData: ActiveSubscription = {
          id: subscription.id,
          plano_id: subscription.plano_id,
          plano_nome: planoData.nome,
          limite_agendamentos_mes: planoData.limite_agendamentos_mes,
          agendamentos_usados: usedCount,
          next_billing_date: subscription.next_billing_date,
          status: subscription.status,
          servico_id: planoData.servico_id || null,
          servico: servicoVinculado
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

  const loadPendingBookingDetails = async (bookingId: string) => {
    try {
      const { data: booking, error } = await supabase
        .from("pending_bookings")
        .select(`*, servico:servicos(*)`)
        .eq("id", bookingId)
        .single();

      if (error) throw error;
      if (!booking) {
        toast.error("Reserva não encontrada ou expirada");
        navigate("/cliente");
        return;
      }

      setSelectedServices([booking.servico]);
      setSelectedDate(new Date(`${booking.data}T12:00:00`));
      setSelectedTime(booking.hora);
      setPendingBookingId(booking.id);

      if (booking.pix_qr_code && booking.pix_payload) {
        setPixQrCode(booking.pix_qr_code);
        setPixPayload(booking.pix_payload);
        setPaymentMethod('pix');
        setPixExpiresAt(booking.expires_at);
        
        // Check if QR Code already expired
        if (new Date(booking.expires_at) <= new Date()) {
          setPixExpired(true);
        } else {
          setPixExpired(false);
        }
        
        setStep(7);
        toast.info("Continue o pagamento do seu agendamento PIX");
      } else {
        setStep(4);
        toast.info("Continue o pagamento do seu agendamento");
      }
    } catch (error) {
      console.error("Error loading pending booking:", error);
      toast.error("Erro ao carregar reserva");
      navigate("/cliente");
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
    if (step === 1 && !selectedBarber) {
      toast.error("Selecione um profissional");
      return;
    }
    
    // Step 2: Serviços (apenas para não-plano e não-remarcação)
    if (!isPlanFlow && !isRescheduling && step === 2 && selectedServices.length === 0) {
      toast.error("Selecione pelo menos um serviço");
      return;
    }
    
    // Validação de data
    const dateStep = isPlanFlow ? 2 : isRescheduling ? 2 : 3;
    if (step === dateStep && !selectedDate) {
      toast.error("Selecione uma data");
      return;
    }
    
    // Validação de horário
    const timeStep = isPlanFlow ? 3 : isRescheduling ? 3 : 4;
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
    
    // Fluxo de plano: após horário (step 3), vai para confirmação (step 4)
    if (isPlanFlow && step === 3) {
      setStep(4);
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

    if (paymentMethod === 'card') {
      if (!cardHolderName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv || !cardCep) {
        toast.error("Preencha todos os dados do cartão");
        return;
      }
    }

    setProcessingPayment(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos * (serviceQuantities[s.id] || 1), 0);
      const serviceNames = selectedServices.map(s => {
        const qty = serviceQuantities[s.id] || 1;
        return qty > 1 ? `${s.nome} x${qty}` : s.nome;
      }).join(", ");

      const mainService = selectedServices[0];
      const bookingData = {
        servico_id: mainService.id,
        barbeiro_id: selectedBarber?.id || null,
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora: selectedTime,
        duracao: totalDuration,
        preco: finalPrice,
        observacoes: selectedServices.length > 1 
          ? `Serviços: ${serviceNames}` 
          : undefined,
      };

      const payload: any = {
        bookingData,
        metodo: paymentMethod,
        creditsUsed: Math.min(availableCredits, totalPrice),
        rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
      };

      if (paymentMethod === 'card') {
        payload.cardInfo = {
          holderName: cardHolderName.trim(),
          number: cardNumber.replace(/\s/g, ''),
          expiryMonth: cardExpiryMonth.trim().padStart(2, '0'),
          expiryYear: cardExpiryYear.trim().length === 2 ? `20${cardExpiryYear.trim()}` : cardExpiryYear.trim(),
          ccv: cardCvv.trim(),
        };

        // Capturar IP do cliente para antifraude do Asaas
        let clientIp = '0.0.0.0';
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          clientIp = ipData.ip || '0.0.0.0';
        } catch (e) {
          console.warn('Could not fetch client IP:', e);
        }

        payload.customerInfo = {
          name: cardHolderName.trim(),
          email: session.user.email,
          postalCode: cardCep.replace(/\D/g, ''),
          remoteIp: clientIp,
        };
      }

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: payload,
      });

      if (error) throw error;

      // Tratar erros retornados pelo gateway (status 400)
      if (data?.error) {
        throw new Error(data.error);
      }

      if (availableCredits > 0 && data.appointmentId) {
        await useCredits(Math.min(availableCredits, totalPrice), data.appointmentId);
      }

      if (useRedemption && data.appointmentId) {
        await markRedemptionAsUsed(data.appointmentId);
      }

      if (paymentMethod === 'cash') {
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
      } else if (paymentMethod === 'pix' && data.asaasPayment?.pixQrCode) {
        setPixQrCode(data.asaasPayment.pixQrCode.encodedImage);
        setPixPayload(data.asaasPayment.pixQrCode.payload);
        setPendingBookingId(data.pendingBookingId || null);
        // Set expiration to 30 minutes from now (matching Asaas default)
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        setPixExpiresAt(expiresAt);
        setPixExpired(false);
        toast.success("QR Code gerado! Escaneie para pagar.");
        setStep(7);
      } else if (paymentMethod === 'card') {
        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');
        
        if (data.asaasPayment?.status === 'CONFIRMED') {
          toast.success("Pagamento aprovado! Agendamento confirmado.");
          navigate("/cliente");
        } else {
          toast.error("Pagamento recusado. Verifique os dados do cartão.");
        }
      }
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos * (serviceQuantities[s.id] || 1), 0);
      const serviceNames = selectedServices.map(s => {
        const qty = serviceQuantities[s.id] || 1;
        return qty > 1 ? `${s.nome} x${qty}` : s.nome;
      }).join(", ");
      const mainService = selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: { data: dateStr, hora: selectedTime, duracao: totalDuration, userId: session.user.id, barberId: selectedBarber?.id }
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
          barbeiro_id: selectedBarber?.id || null,
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos * (serviceQuantities[s.id] || 1), 0);
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
          barberId: selectedBarber?.id,
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
          barbeiro_id: selectedBarber?.id || null,
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos * (serviceQuantities[s.id] || 1), 0);
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
          barberId: selectedBarber?.id
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
          barbeiro_id: selectedBarber?.id || null,
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos * (serviceQuantities[s.id] || 1), 0);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id,
          barberId: selectedBarber?.id,
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
    return selectedServices.reduce((sum, s) => sum + s.duracao_minutos * (serviceQuantities[s.id] || 1), 0);
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
    return Math.max(0, baseTotal - redemptionDiscount);
  };

  const canUseRedemption = availableRedemptions.length > 0 && !!getCorteService();

  const handleBack = () => {
    // NOVO FLUXO: Step 1 = Barbeiro para TODOS
    if (step === 1) {
      // Step 1 (Barbeiro) - volta para home
      navigate("/cliente");
      return;
    }
    
    if (isPlanFlow) {
      // Plano: 1=Barbeiro, 2=Data, 3=Horário, 4=Confirmação
      setStep(step - 1);
    } else if (isRescheduling) {
      // Remarcação: 1=Barbeiro, 2=Data, 3=Horário, 4=Confirmação
      setStep(step - 1);
    } else {
      // Normal: 1=Barbeiro, 2=Serviços, 3=Data, 4=Horário, 5=Pagamento, 6=Confirmação, 7=PIX
      if (step === 7) {
        // Voltando do QR Code PIX para confirmação
        setPixQrCode(null);
        setPixPayload(null);
        setPixExpired(false);
        setPixExpiresAt(null);
        setStep(6);
      } else {
        setStep(step - 1);
      }
    }
  };

  const handleCopyPix = () => {
    if (pixPayload) {
      navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  /** Re-generate PIX QR Code for an existing pending booking */
  const handleRegeneratePix = async () => {
    if (!pendingBookingId) return;
    setRegeneratingPix(true);
    try {
      const { data: oldBooking } = await supabase
        .from("pending_bookings")
        .select("*")
        .eq("id", pendingBookingId)
        .single();

      if (!oldBooking) {
        toast.error("Reserva não encontrada. Crie um novo agendamento.");
        navigate("/cliente");
        return;
      }

      // Delete old pending booking first
      await supabase.from("pending_bookings").delete().eq("id", pendingBookingId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const bookingData = {
        servico_id: oldBooking.servico_id,
        barbeiro_id: oldBooking.barbeiro_id,
        data: oldBooking.data,
        hora: oldBooking.hora,
        duracao: oldBooking.duracao,
        preco: oldBooking.preco,
      };

      const payload: any = {
        bookingData,
        metodo: 'pix' as const,
        excludePendingBookingId: pendingBookingId,
      };

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: payload,
      });

      if (error) throw error;

      if (data.asaasPayment?.pixQrCode) {
        setPixQrCode(data.asaasPayment.pixQrCode.encodedImage);
        setPixPayload(data.asaasPayment.pixQrCode.payload);
        setPendingBookingId(data.pendingBookingId || null);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        setPixExpiresAt(expiresAt);
        setPixExpired(false);
        toast.success("Novo QR Code gerado!");
      }
    } catch (error) {
      console.error("Error regenerating PIX:", error);
      toast.error("Erro ao gerar novo QR Code");
    } finally {
      setRegeneratingPix(false);
    }
  };

  // NOVO CÁLCULO: Step 1 = Barbeiro para TODOS
  // Plano: 4 etapas (Barbeiro, Data, Horário, Confirmação)
  // Remarcação: 4 etapas (Barbeiro, Data, Horário, Confirmação)
  // Normal: 6 etapas (Barbeiro, Serviços, Data, Horário, Pagamento, Confirmação)
  const totalSteps = isPlanFlow ? 4 : isRescheduling ? 4 : 6;
  
  // O step visual agora é direto (step 1-N = bolinha 1-N)
  const currentDisplayStep = Math.min(step, totalSteps);

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  // Tela de Limite Atingido - para quando o usuário já usou todos os agendamentos do plano
  if (subscriptionLimitReached) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
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
    <div className="min-h-screen bg-background">
      {/* Header Minimalista - Apenas Setinha + Bolinhas */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Botão Voltar */}
            <button 
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-card hover:bg-secondary transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>

            {/* Bolinhas de Etapas */}
            <StepDots currentStep={currentDisplayStep} totalSteps={totalSteps} />

            {/* Espaço vazio para balancear */}
            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* STEP 1: ESCOLHER BARBEIRO (para TODOS os usuários) */}
        {step === 1 && (
          <motion.div
            key="step-1-barber"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-20 pb-32 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Escolha o Barbeiro
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione o profissional de sua preferência
                </p>
              </div>

              {barbers.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-primary animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">Carregando barbeiros...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {barbers.map((barber) => (
                    <BarberCard
                      key={barber.id}
                      barber={barber}
                      isSelected={selectedBarber?.id === barber.id}
                      onSelect={() => setSelectedBarber(barber)}
                    />
                  ))}
                </div>
              )}

              {/* Botão Continuar */}
              {selectedBarber && (
                <button
                  onClick={() => setStep(2)}
                  className="w-full mt-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
                >
                  Continuar com {selectedBarber.apelido}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 2: Serviços (APENAS para usuários SEM plano) */}
        {step === 2 && !isPlanFlow && !isRescheduling && (
          <motion.div
            key="step-2-services"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-20 pb-32 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Escolha os Serviços
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
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

        {/* Step 2 (Plano/Remarcação) ou Step 3 (Normal): Data */}
        {((isPlanFlow && step === 2) || (isRescheduling && step === 2) || (!isPlanFlow && !isRescheduling && step === 3)) && (
          <motion.div
            key="step-date"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-20 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Escolha a Data
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isPlanFlow && activeSubscription ? (
                    <>Serviço: <span className="text-primary font-medium">{activeSubscription.servico?.nome}</span> • Barbeiro: <span className="text-primary font-medium">{selectedBarber?.apelido}</span></>
                  ) : selectedBarber ? (
                    <>Barbeiro: <span className="text-primary font-medium">{selectedBarber.apelido}</span></>
                  ) : (
                    "Selecione o dia desejado"
                  )}
                </p>
              </div>

              <PremiumCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {selectedDate && (
                <button
                  onClick={handleNextStep}
                  className="w-full mt-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
                >
                  Continuar
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 3 (Plano/Remarcação) ou Step 4 (Normal): Horário */}
        {((isPlanFlow && step === 3) || (isRescheduling && step === 3) || (!isPlanFlow && !isRescheduling && step === 4)) && (
          <motion.div
            key="step-time"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-20 pb-32 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Escolha o Horário
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
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
                    onClick={() => setStep(isPlanFlow ? 2 : isRescheduling ? 2 : 3)}
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
                              setUnavailableMessage("É necessário 1 hora de antecedência.");
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
            className="min-h-screen pt-20 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Forma de Pagamento
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha como deseja pagar
                </p>
              </div>

              <div className="space-y-3">
                <PaymentOption
                  value="pix"
                  selected={paymentMethod === 'pix'}
                  onSelect={() => setPaymentMethod('pix')}
                  title="PIX"
                  description="Pagamento instantâneo via QR Code"
                  icon={<img src={pixIcon} alt="PIX" className="w-4 h-4 object-contain" />}
                />

                <PaymentOption
                  value="card"
                  selected={paymentMethod === 'card'}
                  onSelect={() => setPaymentMethod('card')}
                  title="Cartão de Crédito"
                  description="Pagamento aprovado na hora"
                />

                <PaymentOption
                  value="cash"
                  selected={paymentMethod === 'cash'}
                  onSelect={() => setPaymentMethod('cash')}
                  title="Pagar na Barbearia"
                  description="Pagamento presencial após confirmação"
                />

                {/* Resgate Grátis */}
                {canUseRedemption && (
                  <div className="relative mt-6">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                        RESGATE DISPONÍVEL
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setUseRedemption(!useRedemption)}
                      className={cn(
                        "w-full text-left rounded-2xl p-5 transition-all duration-200 border",
                        useRedemption 
                          ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/50" 
                          : "bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border-orange-500/30 hover:border-orange-500/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-white mb-1">
                            Corte Grátis Disponível
                          </h3>
                          <p className="text-sm text-zinc-400">
                            Você tem {availableRedemptions.length} resgate{availableRedemptions.length > 1 ? 's' : ''} do programa de fidelidade
                          </p>
                        </div>
                        <div className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center mt-0.5",
                          useRedemption 
                            ? "bg-green-500 border-green-500"
                            : "border-orange-500/50"
                        )}>
                          {useRedemption && (
                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Resumo de valores */}
              <div className="mt-6 bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-sm">Valor do serviço</span>
                  <span className={cn(
                    "text-foreground font-semibold",
                    useRedemption && getCorteService() && "line-through text-muted-foreground"
                  )}>
                    R$ {selectedServices.reduce((sum, s) => sum + s.preco * (serviceQuantities[s.id] || 1), 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {useRedemption && getRedemptionDiscount() > 0 && (
                  <div className="flex items-center justify-between text-success font-semibold text-sm">
                    <span>Desconto (resgate)</span>
                    <span>-R$ {getRedemptionDiscount().toFixed(2).replace('.', ',')}</span>
                  </div>
                )}

                {availableCredits > 0 && getTotalPrice() > 0 && (
                  <div className="flex items-center justify-between text-success text-sm mt-2">
                    <span>Créditos aplicados</span>
                    <span>-R$ {Math.min(availableCredits, getTotalPrice()).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                
                <div className="border-t border-border mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Valor a pagar</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(6)}
                className="w-full mt-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
              >
                Continuar
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4 (Plano) Confirmação - Tela limpa e profissional para usuários de plano */}
        {isPlanFlow && step === 4 && (
          <motion.div
            key="step-plan-confirmation"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-20 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
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

              <button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full py-4 bg-primary text-primary-foreground text-base font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {processingPayment ? 'Agendando...' : 'Confirmar Agendamento'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 6: Confirmação (Usuários normais SEM plano) - oculta quando QR Code PIX é gerado */}
        {step === 6 && !isRescheduling && !isPlanFlow && !pixQrCode && (
          <motion.div
            key="step-5"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-20 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Confirmar Agendamento
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Revise os detalhes antes de finalizar
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
                    availableCredits >= getTotalPrice() ? "Créditos do App" :
                    paymentMethod === 'pix' ? "PIX" :
                    paymentMethod === 'card' ? "Cartão de Crédito" :
                    "Pagar na Barbearia"
                  }
                />
                
                <div className="border-t border-border mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Dados do Cartão */}
              {paymentMethod === 'card' && availableCredits < getTotalPrice() && (
                <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4">
                  <h3 className="text-base font-semibold text-foreground mb-3">Dados do Cartão</h3>
                  
                  <input
                    type="text"
                    placeholder="Nome no cartão"
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                  
                  <input
                    type="text"
                    placeholder="Número do cartão"
                    value={cardNumber}
                    maxLength={19}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                      const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                      setCardNumber(formatted);
                    }}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                  
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="MM"
                      value={cardExpiryMonth}
                      maxLength={2}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setCardExpiryMonth(value);
                      }}
                      className="px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      placeholder="AAAA"
                      value={cardExpiryYear}
                      maxLength={4}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setCardExpiryYear(value);
                      }}
                      className="px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      placeholder="CVV"
                      value={cardCvv}
                      maxLength={4}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setCardCvv(value);
                      }}
                      className="px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  
                  <input
                    type="text"
                    placeholder="CEP do titular (ex: 00000-000)"
                    value={cardCep}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const formatted = value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value;
                      setCardCep(formatted);
                    }}
                    maxLength={9}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
              )}

              {/* Avisos contextuais */}
              {paymentMethod === 'pix' && availableCredits < getTotalPrice() && (
                <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 mb-6">
                  <p className="text-sm text-gold text-center">
                    Ao confirmar, o QR Code PIX será gerado
                  </p>
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full py-4 bg-primary text-primary-foreground text-base font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {processingPayment ? 'Processando...' : 
                  availableCredits >= getTotalPrice() ? 'Confirmar (usando créditos)' :
                  paymentMethod === 'pix' ? 'Gerar QR Code PIX' :
                  'Confirmar Agendamento'
                }
              </button>
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
            className="min-h-screen pt-20 pb-24 px-4"
          >
            <div className="max-w-2xl mx-auto">
              {/* Título da Etapa */}
              <div className="mb-6 pt-4">
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

              <button
                onClick={handleRescheduleUpdate}
                disabled={processingPayment}
                className="w-full py-4 bg-primary text-primary-foreground text-base font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {processingPayment ? 'Remarcando...' : 'Confirmar Remarcação'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 7: QR Code PIX - tela dedicada */}
        {step === 7 && pixQrCode && (
          <motion.div
            key="step-6"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen bg-background pb-8"
          >
            {paymentConfirmed ? (
              <motion.div 
                className="min-h-screen flex flex-col items-center justify-center px-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Círculo animado de sucesso */}
                <motion.div
                  className="relative mb-8"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center border-2 border-success/30">
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 250, damping: 20, delay: 0.5 }}
                    >
                      <Check className="w-12 h-12 text-success" strokeWidth={3} />
                    </motion.div>
                  </div>
                  {/* Pulso animado */}
                  <motion.div
                    className="absolute inset-0 w-24 h-24 rounded-full border-2 border-success/40"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                </motion.div>

                <motion.h2
                  className="text-2xl font-bold text-foreground mb-2 text-center"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  Pagamento Confirmado!
                </motion.h2>

                <motion.p
                  className="text-muted-foreground text-center text-sm mb-2 max-w-xs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  Seu agendamento foi registrado com sucesso.
                </motion.p>

                <motion.p
                  className="text-muted-foreground/60 text-center text-xs mb-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  Redirecionando em instantes…
                </motion.p>

                {/* Barra de progresso do redirecionamento */}
                <motion.div
                  className="w-48 h-1 bg-border rounded-full overflow-hidden mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <motion.div
                    className="h-full bg-success rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3.5, delay: 0.5, ease: "linear" }}
                  />
                </motion.div>

                <motion.button
                  onClick={() => navigate("/cliente")}
                  className="px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.97]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  Ir para tela inicial
                </motion.button>
              </motion.div>
            ) : (
              <>
                {/* Header PIX */}
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setStep(5)} className="w-9 h-9 flex items-center justify-center rounded-full bg-card border border-border/40 hover:bg-secondary transition-all">
                        <ArrowLeft className="w-4 h-4 text-foreground" />
                      </button>
                      <div className="flex items-center gap-2.5">
                        <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
                        <h1 className="text-base font-semibold text-foreground">
                          Pagamento PIX
                        </h1>
                      </div>
                    </div>
                    {/* Countdown timer */}
                    {!pixExpired && timeRemaining && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border/40 rounded-full">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className={cn(
                          "text-xs font-mono font-semibold",
                          parseInt(timeRemaining.split(':')[0]) < 5 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {timeRemaining}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center px-5 pt-6 pb-8 gap-6">
                  {/* Valor com destaque */}
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em] mb-1">Valor a pagar</p>
                    <p className="text-3xl font-bold text-foreground tracking-tight">
                      R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                    </p>
                  </div>

                  {pixExpired ? (
                    /* QR Code expirado */
                    <div className="w-full max-w-sm space-y-4">
                      <div className="bg-card border border-destructive/20 rounded-2xl p-6 text-center space-y-3">
                        <div className="w-12 h-12 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6 text-destructive" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-1">QR Code expirado</h3>
                          <p className="text-xs text-muted-foreground">
                            O tempo se esgotou. Gere um novo para continuar.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleRegeneratePix}
                        disabled={regeneratingPix}
                        className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className={cn("w-4 h-4", regeneratingPix && "animate-spin")} />
                        {regeneratingPix ? 'Gerando...' : 'Gerar Novo QR Code'}
                      </button>

                      <button
                        onClick={() => navigate("/cliente")}
                        className="w-full py-2.5 text-muted-foreground text-xs font-medium hover:text-foreground transition-colors"
                      >
                        Voltar para o início
                      </button>
                    </div>
                  ) : (
                    /* QR Code ativo — layout premium */
                    <div className="w-full max-w-sm flex flex-col items-center gap-5">
                      {/* QR Code com moldura tecnológica */}
                      <div className="relative p-1">
                        {/* Linhas decorativas laterais — canto superior esquerdo */}
                        <div className="absolute -top-1 -left-1 w-8 h-8">
                          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-transparent rounded-full" />
                          <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-primary to-transparent rounded-full" />
                        </div>
                        {/* Canto superior direito */}
                        <div className="absolute -top-1 -right-1 w-8 h-8">
                          <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-l from-primary to-transparent rounded-full" />
                          <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-primary to-transparent rounded-full" />
                        </div>
                        {/* Canto inferior esquerdo */}
                        <div className="absolute -bottom-1 -left-1 w-8 h-8">
                          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-transparent rounded-full" />
                          <div className="absolute bottom-0 left-0 w-[2px] h-full bg-gradient-to-t from-primary to-transparent rounded-full" />
                        </div>
                        {/* Canto inferior direito */}
                        <div className="absolute -bottom-1 -right-1 w-8 h-8">
                          <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-primary to-transparent rounded-full" />
                          <div className="absolute bottom-0 right-0 w-[2px] h-full bg-gradient-to-t from-primary to-transparent rounded-full" />
                        </div>

                        {/* Container do QR Code */}
                        <div className="bg-white rounded-2xl p-3 shadow-lg shadow-primary/5">
                          <img 
                            src={`data:image/png;base64,${pixQrCode}`} 
                            alt="QR Code PIX" 
                            className="w-56 h-56"
                          />
                        </div>
                      </div>

                      {/* Instrução */}
                      <p className="text-xs text-muted-foreground text-center max-w-[240px]">
                        Abra o app do seu banco, escolha pagar com PIX e escaneie o código acima
                      </p>

                      {/* Separador com texto */}
                      <div className="w-full flex items-center gap-3">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">ou copie o código</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>

                      {pixPayload && (
                        <div className="w-full space-y-3">
                          {/* Código PIX com caixa */}
                          <div className="bg-card/60 rounded-xl px-4 py-3 border border-border/30">
                            <p className="text-[10px] font-mono text-muted-foreground/50 break-all leading-relaxed line-clamp-2">
                              {pixPayload}
                            </p>
                          </div>

                          {/* Botão copiar — centralizado e destacado */}
                          <button
                            onClick={handleCopyPix}
                            className={cn(
                              "w-full py-3.5 font-semibold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                              copied 
                                ? "bg-success/15 text-success border border-success/30" 
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4" />
                                Código copiado
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copiar Código PIX
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Status aguardando — pill premium */}
                      <div className="flex items-center gap-2.5 py-2.5 px-5 bg-card border border-border/40 rounded-full mt-1">
                        <div className="relative flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          <div className="absolute w-4 h-4 bg-primary/15 rounded-full animate-ping" />
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                          Aguardando pagamento
                        </p>
                      </div>

                      {/* Selo de segurança */}
                      <div className="flex items-center gap-1.5 text-muted-foreground/40 mt-1">
                        <Shield className="w-3.5 h-3.5" />
                        <p className="text-[11px]">Pagamento seguro via PIX</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClienteAgendar;
