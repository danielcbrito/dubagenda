import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { sendNovoAgendamentoEvent, sendRemarcacaoConcluidaEvent } from "@/lib/webhookService";
import { motion, AnimatePresence } from "framer-motion";

// Premium Components
import { ServiceCard } from "@/components/booking/ServiceCard";
import { TimeSlot } from "@/components/booking/TimeSlot";
import { PaymentOption } from "@/components/booking/PaymentOption";
import { SummaryRow } from "@/components/booking/SummaryRow";
import { PremiumCalendar } from "@/components/booking/PremiumCalendar";
import { StepIndicator } from "@/components/booking/StepIndicator";

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
  const [cardCpf, setCardCpf] = useState("");
  const [resumePendingBookingId, setResumePendingBookingId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
  const servicesListRef = useRef<HTMLDivElement | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [availableRedemptions, setAvailableRedemptions] = useState<{ id: string; promocao_id: string }[]>([]);
  const [useRedemption, setUseRedemption] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPlanEligible =
    !isRescheduling &&
    !!activeSubscription?.servico &&
    selectedServices.length === 1 &&
    selectedServices[0]?.id === activeSubscription.servico.id &&
    activeSubscription.agendamentos_usados < activeSubscription.limite_agendamentos_mes;

  useEffect(() => {
    if (step === 4 && isPlanEligible) setStep(5);
  }, [step, isPlanEligible]);

  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);

  const { 
    slots: availableSlots, 
    loading: loadingSlots, 
    refreshSlots,
    verifySlotAvailability 
  } = useSlotAvailability(
    selectedDate, 
    totalDuration,
    isRescheduling ? rescheduleAppointmentId : null
  );

  // Initialize booking
  useEffect(() => {
    const initializeBooking = async () => {
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
          setSelectedServices([subscription.servico]);
          setStep(2);
          return;
        }

        toast.info(`Você já usou seus ${subscription.limite_agendamentos_mes} agendamentos do plano este mês.`);
      }

      await loadServices();
    };

    initializeBooking();
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.documentElement.classList.add('lock-scroll');
    document.body.classList.add('lock-scroll');

    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setFullHeight();
    window.addEventListener('resize', setFullHeight);

    return () => {
      document.documentElement.classList.remove('lock-scroll');
      document.body.classList.remove('lock-scroll');
      window.removeEventListener('resize', setFullHeight);
    };
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    const el = servicesListRef.current;
    if (!el) return;

    const handleTouchMove = (event: TouchEvent) => {
      event.stopPropagation();
    };

    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', handleTouchMove as any);
    };
  }, [step]);

  useEffect(() => {
    if (selectedDate) {
      setUnavailableMessage(null);
    }
  }, [selectedDate]);

  // Poll for payment confirmation
  useEffect(() => {
    if (step === 6 && pixQrCode && pendingBookingId && !paymentConfirmed) {
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
        setStep(6);
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
        .select(`*, servico:servicos(*)`)
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
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const handleNextStep = async () => {
    if (step === 1 && selectedServices.length === 0) {
      toast.error("Selecione pelo menos um serviço");
      return;
    }
    if (step === 2 && !selectedDate) {
      toast.error("Selecione uma data");
      return;
    }
    if (step === 3 && !selectedTime) {
      toast.error("Selecione um horário");
      return;
    }
    
    if (step === 3 && selectedDate && selectedTime) {
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
    
    if (isRescheduling && step === 3) {
      setStep(5);
      return;
    }
    
    if (step === 3 && isPlanEligible) {
      setStep(5);
      return;
    }

    if (
      step === 3 &&
      !isRescheduling &&
      activeSubscription?.servico &&
      selectedServices.length === 1 &&
      selectedServices[0]?.id === activeSubscription.servico.id &&
      activeSubscription.agendamentos_usados >= activeSubscription.limite_agendamentos_mes
    ) {
      toast.info(`Limite do plano atingido. Este agendamento será considerado avulso.`);
    }

    if (step === 3 && !isRescheduling) {
      const totalPrice = getTotalPrice();
      if (availableCredits >= totalPrice) {
        setPaymentMethod('cash');
        setStep(5);
        return;
      }
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
      if (!cardHolderName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv || !cardCpf) {
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
      const serviceNames = selectedServices.map(s => s.nome).join(", ");

      const mainService = selectedServices[0];
      const bookingData = {
        servico_id: mainService.id,
        barbeiro_id: null,
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
          expiryMonth: cardExpiryMonth.trim(),
          expiryYear: cardExpiryYear.trim(),
          ccv: cardCvv.trim(),
        };

        payload.customerInfo = {
          name: cardHolderName.trim(),
          email: session.user.email,
          cpf: cardCpf.replace(/\D/g, ''),
        };
      }

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: payload,
      });

      if (error) throw error;

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
        toast.success("QR Code gerado! Escaneie para pagar.");
        setStep(6);
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
      const serviceNames = selectedServices.map(s => s.nome).join(", ");
      const mainService = selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: { data: dateStr, hora: selectedTime, duracao: totalDuration, userId: session.user.id }
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
      const serviceNames = selectedServices.map(s => s.nome).join(", ");
      const mainService = selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id,
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
      const serviceNames = selectedServices.map(s => s.nome).join(", ");
      const mainService = selectedServices[0];
      const dateStr = format(selectedDate!, 'yyyy-MM-dd');

      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id
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

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id,
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
    return selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
  };

  const getCorteService = () => {
    return selectedServices.find(s => 
      s.nome.toLowerCase().includes('corte') && 
      !s.nome.toLowerCase().includes('barba')
    );
  };

  const getRedemptionDiscount = () => {
    if (!useRedemption || availableRedemptions.length === 0) return 0;
    const corteService = getCorteService();
    if (!corteService) return 0;
    return corteService.preco;
  };

  const getTotalPrice = () => {
    const baseTotal = selectedServices.reduce((sum, s) => sum + s.preco, 0);
    const redemptionDiscount = getRedemptionDiscount();
    return Math.max(0, baseTotal - redemptionDiscount);
  };

  const canUseRedemption = availableRedemptions.length > 0 && !!getCorteService();

  const handleBack = () => {
    if (activeSubscription?.servico && step === 2) {
      navigate("/cliente");
    } else if (step === 1) {
      navigate("/cliente");
    } else {
      setStep(step - 1);
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

  const totalSteps = isPlanEligible ? 4 : isRescheduling ? 4 : 5;
  const currentDisplayStep = step > 5 ? totalSteps : 
    isPlanEligible && step >= 5 ? step - 1 : 
    isRescheduling && step >= 4 ? step - 1 : step;

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      {/* Header Flutuante Premium */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-6 pt-6 pb-4">
          <div className="relative flex items-center justify-center mb-6">
            <button 
              onClick={handleBack}
              className="absolute left-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            <h1 className="text-xl font-bold text-white tracking-tight">
              {isRescheduling ? "Remarcar Horário" : "Agendar Horário"}
            </h1>
          </div>

          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-500 ease-out"
              style={{ width: `${(currentDisplayStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Serviços */}
        {step === 1 && (
          <motion.div
            key="step-1"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-32 pb-32 px-6"
          >
            <div className="max-w-2xl mx-auto">
              <StepIndicator 
                currentStep={1} 
                totalSteps={totalSteps} 
                title="Escolha os Serviços"
                subtitle="Selecione um ou mais serviços desejados"
              />

              <div ref={servicesListRef} className="space-y-3">
                {services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    isSelected={selectedServices.some(s => s.id === service.id)}
                    onToggle={() => toggleService(service)}
                  />
                ))}
              </div>

              {/* Bottom CTA */}
              {selectedServices.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-xl border-t border-white/5 p-6">
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-zinc-400">
                          {selectedServices.length} {selectedServices.length === 1 ? 'serviço' : 'serviços'} • {getTotalDuration()} min
                        </p>
                        <p className="text-2xl font-bold text-white">
                          R$ {getTotalPrice().toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(2)}
                        className="px-8 py-4 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 2: Data */}
        {step === 2 && (
          <motion.div
            key="step-2"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-32 pb-24 px-6"
          >
            <div className="max-w-2xl mx-auto">
              <StepIndicator 
                currentStep={activeSubscription?.servico ? 1 : 2} 
                totalSteps={totalSteps} 
                title="Escolha a Data"
                subtitle="Selecione o dia desejado para o atendimento"
              />

              <PremiumCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {selectedDate && (
                <button
                  onClick={handleNextStep}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-primary/25 transition-all"
                >
                  Continuar
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 3: Horário */}
        {step === 3 && (
          <motion.div
            key="step-3"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-32 pb-32 px-6"
          >
            <div className="max-w-2xl mx-auto">
              <StepIndicator 
                currentStep={activeSubscription?.servico ? 2 : 3} 
                totalSteps={totalSteps} 
                title="Escolha o Horário"
                subtitle={selectedDate ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR }) : undefined}
              />

              {loadingSlots ? (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-primary animate-spin" />
                  </div>
                  <p className="text-sm text-zinc-400">Carregando horários disponíveis...</p>
                </div>
              ) : availableSlots.filter(slot => slot.available).length === 0 ? (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center">
                  <p className="text-zinc-400 font-medium mb-4">
                    Agenda cheia neste dia.
                  </p>
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-3 border border-white/10 rounded-xl text-white hover:bg-white/5 transition-all"
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
                    <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                      <p className="text-sm text-red-400 font-medium">{unavailableMessage}</p>
                    </div>
                  )}

                  {selectedTime && (
                    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-xl border-t border-white/5 p-6">
                      <div className="max-w-2xl mx-auto">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                              <Clock className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-zinc-400">Horário selecionado</p>
                              <p className="text-xl font-bold text-white">
                                {selectedDate && format(selectedDate, 'd/MM')} às {selectedTime}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleNextStep}
                            disabled={loading}
                            className="px-8 py-4 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50"
                          >
                            {loading ? "Verificando..." : "Continuar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 4: Pagamento */}
        {step === 4 && !isRescheduling && (
          <motion.div
            key="step-4"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-32 pb-24 px-6"
          >
            <div className="max-w-2xl mx-auto">
              <StepIndicator 
                currentStep={4} 
                totalSteps={totalSteps} 
                title="Forma de Pagamento"
                subtitle="Escolha como deseja pagar"
              />

              <div className="space-y-3">
                <PaymentOption
                  value="pix"
                  selected={paymentMethod === 'pix'}
                  onSelect={() => setPaymentMethod('pix')}
                  title="PIX"
                  description="Pagamento instantâneo via QR Code"
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
              <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400">Valor do serviço</span>
                  <span className={cn(
                    "text-white font-semibold",
                    useRedemption && getCorteService() && "line-through text-zinc-500"
                  )}>
                    R$ {selectedServices.reduce((sum, s) => sum + s.preco, 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {useRedemption && getRedemptionDiscount() > 0 && (
                  <div className="flex items-center justify-between text-green-400 font-semibold">
                    <span>Desconto (resgate)</span>
                    <span>-R$ {getRedemptionDiscount().toFixed(2).replace('.', ',')}</span>
                  </div>
                )}

                {availableCredits > 0 && getTotalPrice() > 0 && (
                  <div className="flex items-center justify-between text-green-400 text-sm mt-2">
                    <span>Créditos aplicados</span>
                    <span>-R$ {Math.min(availableCredits, getTotalPrice()).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                
                <div className="border-t border-white/5 mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">Valor a pagar</span>
                    <span className="text-3xl font-bold text-primary">
                      R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(5)}
                className="w-full mt-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-primary/25 transition-all"
              >
                Continuar
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 5: Confirmação */}
        {step === 5 && !isRescheduling && (
          <motion.div
            key="step-5"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen pt-32 pb-24 px-6"
          >
            <div className="max-w-2xl mx-auto">
              <StepIndicator 
                currentStep={isPlanEligible ? 3 : 5} 
                totalSteps={totalSteps} 
                title="Confirmar Agendamento"
                subtitle="Revise os detalhes antes de finalizar"
              />

              {/* Card de resumo */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl space-y-4 mb-6">
                <SummaryRow 
                  label="Serviço"
                  value={selectedServices.map(s => s.nome).join(", ")}
                />
                
                <div className="border-t border-white/5" />
                
                <SummaryRow 
                  label="Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />
                
                <div className="border-t border-white/5" />
                
                <SummaryRow 
                  label="Horário"
                  value={selectedTime}
                />
                
                <div className="border-t border-white/5" />
                
                <SummaryRow 
                  label="Forma de Pagamento"
                  value={
                    isPlanEligible ? `Plano (${activeSubscription?.plano_nome})` :
                    useRedemption && getTotalPrice() === 0 ? "Resgate de Fidelidade" :
                    availableCredits >= getTotalPrice() ? "Créditos do App" :
                    paymentMethod === 'pix' ? "PIX" :
                    paymentMethod === 'card' ? "Cartão de Crédito" :
                    "Pagar na Barbearia"
                  }
                />
                
                <div className="border-t border-white/5 mt-6 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">Total</span>
                    <span className="text-3xl font-bold text-primary">
                      R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Dados do Cartão */}
              {paymentMethod === 'card' && !isPlanEligible && availableCredits < getTotalPrice() && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Dados do Cartão</h3>
                  
                  <input
                    type="text"
                    placeholder="Nome no cartão"
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
                  />
                  
                  <input
                    type="text"
                    placeholder="Número do cartão"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
                  />
                  
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="MM"
                      value={cardExpiryMonth}
                      onChange={(e) => setCardExpiryMonth(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      placeholder="AA"
                      value={cardExpiryYear}
                      onChange={(e) => setCardExpiryYear(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      placeholder="CVV"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  
                  <input
                    type="text"
                    placeholder="CPF do titular"
                    value={cardCpf}
                    onChange={(e) => setCardCpf(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
                  />
                </div>
              )}

              {/* Avisos contextuais */}
              {isPlanEligible && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 mb-6">
                  <p className="text-sm text-green-400 text-center">
                    Este agendamento será registrado como PLANO. Nenhum pagamento será solicitado.
                  </p>
                </div>
              )}

              {!isPlanEligible && paymentMethod === 'pix' && availableCredits < getTotalPrice() && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 mb-6">
                  <p className="text-sm text-orange-300 text-center">
                    Ao confirmar, o QR Code PIX será gerado para pagamento
                  </p>
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full py-5 bg-gradient-to-r from-primary to-primary/80 text-white text-lg font-bold rounded-2xl hover:shadow-xl hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {processingPayment ? 'Processando...' : 
                  isPlanEligible ? 'Finalizar (usando PLANO)' :
                  availableCredits >= getTotalPrice() ? 'Confirmar (usando créditos)' :
                  paymentMethod === 'pix' ? 'Gerar QR Code PIX' :
                  'Confirmar Agendamento'
                }
              </button>
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
            className="min-h-screen pt-32 pb-24 px-6"
          >
            <div className="max-w-2xl mx-auto">
              <StepIndicator 
                currentStep={3} 
                totalSteps={3} 
                title="Confirmar Remarcação"
                subtitle="Revise os novos dados"
              />

              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl space-y-4 mb-6">
                <SummaryRow 
                  label="Nova Data"
                  value={selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
                />
                
                <div className="border-t border-white/5" />
                
                <SummaryRow 
                  label="Novo Horário"
                  value={selectedTime}
                />
                
                <div className="border-t border-white/5" />
                
                <SummaryRow 
                  label="Serviço"
                  value={selectedServices[0]?.nome || ""}
                />
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-6">
                <p className="text-sm text-blue-300 text-center">
                  O pagamento existente permanecerá válido
                </p>
              </div>

              <button
                onClick={handleRescheduleUpdate}
                disabled={processingPayment}
                className="w-full py-5 bg-gradient-to-r from-primary to-primary/80 text-white text-lg font-bold rounded-2xl hover:shadow-xl hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {processingPayment ? 'Remarcando...' : 'Confirmar Remarcação'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 6: QR Code PIX */}
        {step === 6 && pixQrCode && (
          <motion.div
            key="step-6"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-screen bg-white"
          >
            {paymentConfirmed ? (
              <div className="min-h-screen flex flex-col items-center justify-center px-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                  <Check className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Pagamento confirmado!</h2>
                <p className="text-zinc-500 text-center mb-8">
                  Seu agendamento foi confirmado. Você será redirecionado automaticamente...
                </p>
                <button
                  onClick={() => navigate("/cliente")}
                  className="px-8 py-4 bg-zinc-900 text-white font-semibold rounded-2xl"
                >
                  Ir para tela inicial
                </button>
              </div>
            ) : (
              <>
                {/* Header minimalista branco */}
                <div className="bg-gradient-to-b from-zinc-50 to-white border-b border-zinc-200 px-6 py-4">
                  <button onClick={() => setStep(5)} className="mb-4">
                    <ArrowLeft className="w-6 h-6 text-zinc-900" />
                  </button>
                  <div className="text-center">
                    <h1 className="text-2xl font-bold text-zinc-900 mb-1">
                      Pagamento PIX
                    </h1>
                    <p className="text-sm text-zinc-500">
                      Escaneie o código ou copie a chave
                    </p>
                  </div>
                </div>

                <div className="max-w-md mx-auto px-6 py-8">
                  {/* Valor */}
                  <div className="text-center mb-8">
                    <p className="text-sm text-zinc-500 mb-2">Valor a pagar</p>
                    <p className="text-5xl font-bold text-zinc-900">
                      R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2).replace('.', ',')}
                    </p>
                  </div>

                  {/* QR Code - LIMPO */}
                  <div className="bg-white rounded-3xl p-8 shadow-xl border border-zinc-200 mb-6 flex justify-center">
                    <img 
                      src={`data:image/png;base64,${pixQrCode}`} 
                      alt="QR Code PIX" 
                      className="w-64 h-64"
                    />
                  </div>

                  {/* Instruções */}
                  <div className="text-center mb-6">
                    <p className="text-sm text-zinc-600">
                      Abra o app do seu banco e escaneie o código acima para pagar
                    </p>
                  </div>

                  {/* Código PIX para copiar */}
                  {pixPayload && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide text-center">
                        Ou copie o código PIX
                      </p>
                      
                      <div className="bg-zinc-100 rounded-2xl p-4 border border-zinc-200">
                        <p className="text-xs font-mono text-zinc-700 break-all leading-relaxed">
                          {pixPayload}
                        </p>
                      </div>

                      <button
                        onClick={handleCopyPix}
                        className="w-full py-4 bg-zinc-900 text-white font-semibold rounded-2xl hover:bg-zinc-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Copy className="w-5 h-5" />
                        {copied ? 'Código Copiado!' : 'Copiar Código PIX'}
                      </button>
                    </div>
                  )}

                  {/* Status de pagamento */}
                  <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-zinc-500">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      Aguardando confirmação do pagamento
                    </div>
                  </div>
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
