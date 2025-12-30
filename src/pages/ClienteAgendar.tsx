import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Clock, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { sendNovoAgendamentoEvent, sendRemarcacaoConcluidaEvent } from "@/lib/webhookService";

interface Service {
  id: string;
  nome: string;
  descricao: string;
  duracao_minutos: number;
  preco: number;
}

// Interface para assinatura ativa
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
  
  // NOVO: Estado para assinatura ativa do usuário
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  
  // NOVO: Estado para resgates disponíveis (corte grátis do programa de fidelidade)
  const [availableRedemptions, setAvailableRedemptions] = useState<{ id: string; promocao_id: string }[]>([]);
  const [useRedemption, setUseRedemption] = useState(false);

  /**
   * PLANO: o agendamento só é tratado como "via plano" quando:
   * - existe assinatura ativa com serviço vinculado
   * - o usuário está agendando exatamente o serviço do plano (sem extras)
   * - ainda não atingiu o limite mensal
   *
   * Isso corrige o bug de cair no fluxo de pagamento indevidamente e também
   * evita que o plano seja aplicado em serviços fora da cobertura.
   */
  const isPlanEligible =
    !isRescheduling &&
    !!activeSubscription?.servico &&
    selectedServices.length === 1 &&
    selectedServices[0]?.id === activeSubscription.servico.id &&
    activeSubscription.agendamentos_usados < activeSubscription.limite_agendamentos_mes;

  // Guard extra: se por qualquer motivo cair na etapa de pagamento, pular para confirmação do plano
  useEffect(() => {
    if (step === 4 && isPlanEligible) setStep(5);
  }, [step, isPlanEligible]);

  // Calcular duração total dos serviços selecionados
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);

  // NOVO HOOK: Gerencia toda a lógica de disponibilidade de slots
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

  useEffect(() => {
    const initializeBooking = async () => {
      // Carregar dados essenciais primeiro (evita "flash" da lista de serviços para assinantes)
      await loadUserCredits();
      await loadAvailableRedemptions(); // Carregar resgates disponíveis

      // Fluxos especiais têm prioridade (pagamento pendente / remarcação)
      const resumeBookingId = sessionStorage.getItem('resumePendingBookingId');
      if (resumeBookingId) {
        setResumePendingBookingId(resumeBookingId);
        sessionStorage.removeItem('resumePendingBookingId');
        loadPendingBookingDetails(resumeBookingId);
        return; // Sair aqui pois já tem fluxo próprio
      }

      const isReschedulingSession = sessionStorage.getItem('isRescheduling');
      const appointmentId = sessionStorage.getItem('rescheduleAppointmentId');

      if (isReschedulingSession === 'true' && appointmentId) {
        setIsRescheduling(true);
        setRescheduleAppointmentId(appointmentId);
        loadAppointmentForReschedule(appointmentId);
        return; // Sair aqui pois já tem fluxo próprio
      }

      // Assinatura ativa (se existir)
      const subscription = await loadActiveSubscription();

      // Se usuário é assinante com serviço vinculado e ainda tem uso do plano,
      // pré-selecionar e pular step 1 sem carregar lista de serviços (UX mais limpa)
      if (subscription?.servico) {
        const restantes = subscription.limite_agendamentos_mes - subscription.agendamentos_usados;

        if (restantes > 0) {
          console.log('[initializeBooking] Assinante detectado! Pré-selecionando serviço:', subscription.servico.nome);
          setSelectedServices([subscription.servico]);
          setStep(2); // Ir direto para seleção de data
          // Removido toast de "Plano" - usuário já sabe que tem plano
          return;
        }

        // Limite atingido - permitir agendar serviços avulsos
        console.log('[initializeBooking] Limite do plano atingido! Usuário pode agendar serviços avulsos.');
        toast.info(`Você já usou seus ${subscription.limite_agendamentos_mes} agendamentos do plano este mês. Você pode agendar serviços avulsos.`);
      }

      await loadServices();
    };

    initializeBooking();
  }, []);


  // Lock body scroll and set dynamic viewport height for mobile
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

  // Prevent scroll chaining on the services list container
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

  // Limpar mensagem de indisponibilidade quando mudar data
  useEffect(() => {
    if (selectedDate) {
      setUnavailableMessage(null);
    }
  }, [selectedDate]);

  // Poll for payment confirmation when showing PIX QR Code
  useEffect(() => {
    if (step === 6 && pixQrCode && pendingBookingId && !paymentConfirmed) {
      const pollInterval = setInterval(async () => {
        try {
          // Check if pending booking still exists
          const { data: pendingBooking, error } = await supabase
            .from("pending_bookings")
            .select("id")
            .eq("id", pendingBookingId)
            .maybeSingle();

          if (error) {
            console.error("Error checking pending booking:", error);
            return;
          }

          // If pending booking no longer exists, payment was confirmed
          if (!pendingBooking) {
            setPaymentConfirmed(true);
            clearInterval(pollInterval);
            toast.success("Pagamento confirmado!");
            
            // Auto-redirect after 4 seconds
            setTimeout(() => {
              navigate("/cliente");
            }, 4000);
          }
        } catch (error) {
          console.error("Error polling payment status:", error);
        }
      }, 3000); // Poll every 3 seconds

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

  // NOVO: Carregar resgates disponíveis (corte grátis do programa de fidelidade)
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
      console.log('[loadAvailableRedemptions] Resgates disponíveis:', redemptions?.length || 0);
    } catch (error) {
      console.error("Error loading redemptions:", error);
    }
  };

  // NOVO: Carregar assinatura ativa do usuário
  const loadActiveSubscription = async (): Promise<ActiveSubscription | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      // Buscar assinatura ativa com dados do plano e serviço vinculado
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

      if (error) {
        console.error("Error loading subscription:", error);
        return null;
      }

      if (subscription && subscription.plano) {
        // Verificar se plano está vencido (bloquear se passou da data de vencimento)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const billingDate = new Date(subscription.next_billing_date + 'T12:00:00');
        billingDate.setHours(0, 0, 0, 0);
        
        const isOverdue = today > billingDate;

        if (isOverdue) {
          console.log('[loadActiveSubscription] Plano vencido em:', subscription.next_billing_date);
          setSubscriptionBlocked(true);
          toast.error("Seu plano está vencido. Regularize o pagamento para continuar agendando.");
          return null;
        }

        // Contar agendamentos do mês atual
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

        // Buscar dados completos do serviço vinculado ao plano
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

        console.log('[loadActiveSubscription] Assinatura ativa encontrada:', {
          plano: planoData.nome,
          limite: planoData.limite_agendamentos_mes,
          usados: usedCount,
          vencimento: subscription.next_billing_date,
          servico: servicoVinculado?.nome || 'Não vinculado'
        });

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
        .select(`
          *,
          servico:servicos(*)
        `)
        .eq("id", bookingId)
        .single();

      if (error) throw error;
      if (!booking) {
        toast.error("Reserva não encontrada ou expirada");
        navigate("/cliente");
        return;
      }

      // Set booking details
      setSelectedServices([booking.servico]);
      setSelectedDate(new Date(`${booking.data}T12:00:00`));
      setSelectedTime(booking.hora);
      setPendingBookingId(booking.id);

      // Se já existe QR Code PIX salvo, ir direto para a tela do QR Code
      if (booking.pix_qr_code && booking.pix_payload) {
        console.log('[loadPendingBookingDetails] QR Code PIX encontrado, exibindo...');
        setPixQrCode(booking.pix_qr_code);
        setPixPayload(booking.pix_payload);
        setPaymentMethod('pix');
        setStep(6); // Ir direto para tela do QR Code
        toast.info("Continue o pagamento do seu agendamento PIX");
      } else {
        // Sem QR Code salvo, ir para seleção de pagamento
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
        .select(`
          *,
          servico:servicos(*)
        `)
        .eq("id", appointmentId)
        .single();

      if (error) throw error;
      if (!appointment) {
        toast.error("Agendamento não encontrado");
        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');
        return;
      }

      // Set appointment details
      setSelectedServices([appointment.servico]);
      setStep(2); // Go to date selection
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
    
    // VALIDAÇÃO CRÍTICA: Verificar disponibilidade do slot ANTES de avançar do step 3
    if (step === 3 && selectedDate && selectedTime) {
      setLoading(true);
      try {
        // Usar o hook para verificar disponibilidade (double-check direto no banco)
        const result = await verifySlotAvailability(selectedTime);
        
        if (!result.available) {
          console.log('[handleNextStep] Horário INDISPONÍVEL:', result.message);
          toast.error(result.message || "Este horário acabou de ser reservado. Por favor, escolha outro.");
          refreshSlots();
          setSelectedTime("");
          setLoading(false);
          return;
        }
        
        console.log('[handleNextStep] Horário DISPONÍVEL, avançando...');
        setLoading(false);
      } catch (err) {
        console.error('[handleNextStep] Erro:', err);
        setLoading(false);
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }
    }
    
    // If rescheduling and in step 3 (time selection), skip to confirmation
    if (isRescheduling && step === 3) {
      setStep(5); // Go to confirmation step for reschedule
      return;
    }
    
    // PLANO: só pular pagamento quando o agendamento é elegível (serviço do plano + dentro do limite)
    if (step === 3 && isPlanEligible) {
      console.log('[handleNextStep] Agendamento via PLANO elegível, pulando pagamento');
      setStep(5);
      return;
    }

    // Se o usuário escolheu o serviço do plano mas já atingiu o limite, segue fluxo avulso (pagamento)
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

    
    // Se créditos cobrem 100% do valor, pular step 4 (pagamento) e ir direto para confirmação
    if (step === 3 && !isRescheduling) {
      const totalPrice = getTotalPrice();
      if (availableCredits >= totalPrice) {
        console.log('[handleNextStep] Créditos cobrem 100%, pulando para confirmação');
        setPaymentMethod('cash'); // Define como cash pois será pago com créditos
        setStep(5); // Pula step 4 e vai direto para confirmação
        return;
      }
    }
    
    setStep(step + 1);
  };

  // Removed createAppointment - now happens during payment

  const handlePayment = async () => {
    if (!selectedDate || !selectedTime || selectedServices.length === 0) {
      toast.error("Dados do agendamento inválidos");
      return;
    }

    // PLANO: criar agendamento com plano (sem pagamento) apenas quando elegível
    if (isPlanEligible) {
      await createAppointmentWithPlan();
      return;
    }


    const totalPrice = getTotalPrice(); // Já considera desconto do resgate
    const finalPrice = Math.max(0, totalPrice - availableCredits);

    // Se resgate cobriu 100% do corte e não há valor a pagar, criar agendamento direto
    if (totalPrice === 0 && useRedemption) {
      await createAppointmentWithRedemption();
      return;
    }

    // If fully covered by credits, create appointment directly
    if (finalPrice === 0) {
      await createAppointmentWithCredits(totalPrice);
      return;
    }

    // Validate card data if paying with card
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

      // Prepare booking data
      const mainService = selectedServices[0];
      const bookingData = {
        servico_id: mainService.id,
        barbeiro_id: null,
        data: format(selectedDate, 'yyyy-MM-dd'), // Format without timezone conversion
        hora: selectedTime,
        duracao: totalDuration,
        preco: finalPrice, // Use final price after credits
        observacoes: selectedServices.length > 1 
          ? `Serviços: ${serviceNames}` 
          : undefined,
      };

      // Prepare payment payload
      const payload: any = {
        bookingData,
        metodo: paymentMethod,
        creditsUsed: Math.min(availableCredits, totalPrice),
        rescheduleFromId: isRescheduling ? rescheduleAppointmentId : undefined,
      };

      // For card, add card and customer info
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

      // Call payment function
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: payload,
      });

      if (error) {
        throw error;
      }

      // If credits were used, mark them as used
      if (availableCredits > 0 && data.appointmentId) {
        await useCredits(Math.min(availableCredits, totalPrice), data.appointmentId);
      }

      // Marcar resgate como usado (se aplicável)
      if (useRedemption && data.appointmentId) {
        await markRedemptionAsUsed(data.appointmentId);
      }

      // Handle response based on payment method
      if (paymentMethod === 'cash') {
        // Clear rescheduling session data
        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');
        
        // Enviar evento de novo agendamento
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
        
        toast.success("Agendamento criado!" + (useRedemption ? " Corte grátis resgatado! Pague o restante na barbearia." : " Pague na barbearia."));
        navigate("/cliente");
      } else if (paymentMethod === 'pix' && data.asaasPayment?.pixQrCode) {
        setPixQrCode(data.asaasPayment.pixQrCode.encodedImage);
        setPixPayload(data.asaasPayment.pixQrCode.payload);
        setPendingBookingId(data.pendingBookingId || null);
        toast.success("QR Code gerado! Escaneie para pagar.");
        setStep(6);
      } else if (paymentMethod === 'card') {
        // Clear rescheduling session data
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
      
      // Tratar erro de conflito (horário já ocupado)
      if (error.message?.includes('TIME_SLOT_UNAVAILABLE') || error.message?.includes('indisponível') || error.message?.includes('Horário')) {
        toast.error(error.message || "Horário indisponível. Escolha outro horário.");
        // Voltar para seleção de horário e recarregar slots
        setStep(3);
        refreshSlots();
      } else {
        toast.error("Erro ao processar pagamento: " + (error.message || "Erro desconhecido"));
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  // NOVO: Criar agendamento usando resgate (corte grátis do programa de fidelidade)
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

      // Validar disponibilidade
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: { data: dateStr, hora: selectedTime, duracao: totalDuration, userId: session.user.id }
      });

      if (validationError || !validation?.valid) {
        toast.error(validation?.message || "Horário indisponível. Escolha outro.");
        setStep(3);
        refreshSlots();
        return;
      }

      // Criar agendamento grátis (resgate)
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

      // Marcar resgate como usado
      await markRedemptionAsUsed(appointment.id);

      // Enviar evento
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

      toast.success("🎁 Corte grátis resgatado com sucesso!");
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

      // ============================================
      // VALIDAÇÃO CRÍTICA: Verificar disponibilidade antes de criar
      // ============================================
      console.log('[ClienteAgendar] Validando disponibilidade...');
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
        console.error('[ClienteAgendar] Erro na validação:', validationError);
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }

      if (!validation?.valid) {
        console.log('[ClienteAgendar] Horário INDISPONÍVEL:', validation?.message);
        toast.error(validation?.message || "Horário indisponível. Escolha outro horário.");
        // Voltar para seleção de horário
        setStep(3);
        refreshSlots();
        return;
      }
      console.log('[ClienteAgendar] Horário DISPONÍVEL, criando agendamento...');

      // If rescheduling, cancel old appointment first
      if (isRescheduling && rescheduleAppointmentId) {
        await supabase
          .from("agendamentos")
          .update({ 
            status: 'cancelled_by_user' as any,
            visivel_para_usuario: false
          } as any)
          .eq("id", rescheduleAppointmentId);
      }

      // Create appointment directly (paid with credits)
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
          preco: 0, // Fully paid with credits
          status: "pending",
          observacoes: observacoesText,
          payment_method: 'credit', // Mark as credit payment
          is_free: true, // Mark as free (using credits)
          remarcado_de: isRescheduling ? rescheduleAppointmentId : null,
          barbeiro_confirmou: false,
          cliente_confirmou: false,
        })
        .select()
        .single();

      if (aptError) throw aptError;

      // Create payment record
      await supabase
        .from("pagamentos")
        .insert({
          user_id: session.user.id,
          agendamento_id: appointment.id,
          metodo: "cash", // Mark as cash since paid with credits
          valor: 0,
          status: "paid",
        });

      // Use credits
      await useCredits(totalPrice, appointment.id);

      // Marcar resgate como usado (se aplicável)
      if (useRedemption) {
        await markRedemptionAsUsed(appointment.id);
      }

      // Clear rescheduling session data
      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');

      // Enviar evento de novo agendamento
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

      toast.success("Agendamento criado! " + (useRedemption ? "Corte grátis resgatado!" : "Créditos aplicados com sucesso."));
      navigate("/cliente");
    } catch (error: any) {
      console.error('Error creating appointment with credits:', error);
      toast.error("Erro ao criar agendamento: " + (error.message || "Erro desconhecido"));
    } finally {
      setProcessingPayment(false);
    }
  };

  // NOVO: Criar agendamento usando o plano (sem pagamento)
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

      // Verificar disponibilidade antes de criar
      console.log('[createAppointmentWithPlan] Validando disponibilidade...');
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id
        }
      });

      if (validationError) {
        console.error('[createAppointmentWithPlan] Erro na validação:', validationError);
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }

      if (!validation?.valid) {
        console.log('[createAppointmentWithPlan] Horário INDISPONÍVEL:', validation?.message);
        toast.error(validation?.message || "Horário indisponível. Escolha outro horário.");
        setStep(3);
        refreshSlots();
        return;
      }

      console.log('[createAppointmentWithPlan] Criando agendamento com plano:', activeSubscription.plano_nome);

      // Criar agendamento marcado como "plano"
      const { data: appointment, error: aptError } = await supabase
        .from("agendamentos")
        .insert({
          user_id: session.user.id,
          servico_id: mainService.id,
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          preco: 0, // Sem custo - coberto pelo plano
          status: "pending",
          observacoes: selectedServices.length > 1 
            ? `Serviços: ${serviceNames}. Agendamento via ${activeSubscription.plano_nome}` 
            : `Agendamento via ${activeSubscription.plano_nome}`,
          payment_method: 'plano', // Marcar como pagamento via plano
          tipo_agendamento: 'plano', // Tipo especial para contagem
          is_free: true,
          barbeiro_confirmou: false,
          cliente_confirmou: false,
        })
        .select()
        .single();

      if (aptError) throw aptError;

      // Criar registro de pagamento como "pago" (via plano)
      await supabase
        .from("pagamentos")
        .insert({
          user_id: session.user.id,
          agendamento_id: appointment.id,
          metodo: "cash",
          valor: 0,
          status: "paid",
        });

      // Enviar evento de novo agendamento
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
      console.log(`[useCredits] Chamando função atômica para debitar R$ ${amount}`);
      
      // Usar função atômica do banco de dados para garantir transação segura
      const { data, error } = await supabase.rpc('use_credits_atomic', {
        p_user_id: userId,
        p_appointment_id: appointmentId,
        p_amount: amount
      });

      if (error) {
        console.error('[useCredits] Erro na função atômica:', error);
        throw error;
      }

      // Cast para tipo esperado
      const result = data as { success: boolean; error?: string; used_amount?: number } | null;

      if (!result?.success) {
        console.error('[useCredits] Falha no débito:', result?.error);
        throw new Error(result?.error || 'Erro ao debitar créditos');
      }

      console.log(`[useCredits] Débito atômico concluído: R$ ${result.used_amount} usado com sucesso`);
      
      // Atualizar saldo local imediatamente
      setAvailableCredits(prev => Math.max(0, prev - amount));
      
    } catch (error) {
      console.error("Error using credits:", error);
      throw error; // Re-throw to handle in caller
    }
  };

  // NOVO: Marcar resgate como usado
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
      
      console.log('[markRedemptionAsUsed] Resgate usado:', redemptionToUse.id);
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
      
      // ============================================
      // VALIDAÇÃO CRÍTICA: Verificar disponibilidade antes de remarcar
      // ============================================
      console.log('[ClienteAgendar] Validando disponibilidade para remarcação...');
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id,
          excludeAppointmentId: rescheduleAppointmentId // Excluir o próprio agendamento
        }
      });

      if (validationError) {
        console.error('[ClienteAgendar] Erro na validação:', validationError);
        toast.error("Erro ao verificar disponibilidade. Tente novamente.");
        return;
      }

      if (!validation?.valid) {
        console.log('[ClienteAgendar] Horário INDISPONÍVEL:', validation?.message);
        toast.error(validation?.message || "Horário indisponível. Escolha outro horário.");
        setStep(3);
        refreshSlots();
        return;
      }
      console.log('[ClienteAgendar] Horário DISPONÍVEL, remarcando...');
      
      // UPDATE the existing appointment
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data: dateStr,
          hora: selectedTime,
          duracao: totalDuration,
          status: 'pending', // Reset to pending
          barbeiro_confirmou: false, // Volta para confirmação do barbeiro
          cliente_confirmou: false, // Volta para confirmação do cliente
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", rescheduleAppointmentId);

      if (error) throw error;

      // Clear reschedule session
      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');

      // Enviar evento de remarcação concluída
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

      toast.success("✅ Agendamento remarcado com sucesso!");
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

  // Verifica se algum serviço selecionado é um "Corte" (para aplicar desconto do resgate)
  const getCorteService = () => {
    return selectedServices.find(s => 
      s.nome.toLowerCase().includes('corte') && 
      !s.nome.toLowerCase().includes('barba')
    );
  };

  // Calcula o desconto do resgate (valor do corte)
  const getRedemptionDiscount = () => {
    if (!useRedemption || availableRedemptions.length === 0) return 0;
    const corteService = getCorteService();
    if (!corteService) return 0;
    return corteService.preco;
  };

  const getTotalPrice = () => {
    const baseTotal = selectedServices.reduce((sum, s) => sum + s.preco, 0);
    // Aplicar desconto do resgate (corte grátis) se ativo
    const redemptionDiscount = getRedemptionDiscount();
    return Math.max(0, baseTotal - redemptionDiscount);
  };

  // Verifica se o usuário pode usar resgate (tem serviço de corte selecionado)
  const canUseRedemption = availableRedemptions.length > 0 && !!getCorteService();

  const progressValue = (step / 6) * 100;

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden relative"
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* Premium Animated Background - Same as Admin */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0E0E11] via-[#141418] to-[#0E0E11]" />
        
        {/* Animated red glow orbs */}
        <div 
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-20 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(255, 59, 59, 0.4) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        />
        <div 
          className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(255, 59, 59, 0.35) 0%, transparent 70%)',
            filter: 'blur(50px)',
            animationDelay: '2s',
            animation: 'pulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        />
        <div 
          className="absolute top-2/3 left-1/2 w-[300px] h-[300px] rounded-full opacity-10 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(255, 59, 59, 0.3) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animationDelay: '1s',
            animation: 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        />
        
        {/* Subtle noise texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }}
        />
      </div>
      {/* Header Premium - No divider line */}
      <div className="glass-card rounded-none border-0 border-b border-white/5 p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                // Assinante com serviço vinculado: step 2 volta para /cliente (não para step 1 de preços)
                if (activeSubscription?.servico && step === 2) {
                  navigate("/cliente");
                } else if (step === 1) {
                  navigate("/cliente");
                } else {
                  setStep(step - 1);
                }
              }}
              className="h-10 w-10 rounded-full hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-xl responsive-title tracking-tight">Agendar Horário</h1>
          </div>
          <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressValue}%`,
                background: 'linear-gradient(90deg, hsl(0 64% 52%), hsl(0 64% 62%))',
                boxShadow: '0 0 20px rgba(212, 49, 49, 0.5)'
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          {/* Step 1: Select Services */}
          {step === 1 && (
            <>
              {/* Services List - Scrollable Container */}
              <div ref={servicesListRef} className="services-list flex-1 p-4 md:p-6">

                <div className="space-y-3 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1 text-muted-foreground">Etapa 1 de 5</h3>
                    <h2 className="text-xl md:text-2xl font-bold mb-2 responsive-title">Escolha os Serviços</h2>
                    <p className="text-sm text-muted-foreground responsive-text">
                      Selecione um ou mais serviços
                    </p>
                  </div>
                </div>
                
                <div className="grid gap-4 pb-6">
                  {services.map((service) => {
                    const isSelected = selectedServices.some(s => s.id === service.id);
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleService(service)}
                        className={cn(
                          "glass-card mirror-shine cursor-pointer p-5 transition-all duration-300 hover-elevate",
                          isSelected && "ring-2 ring-primary shadow-glow-red"
                        )}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-base responsive-text">{service.nome}</h4>
                              {isSelected && (
                                <div 
                                  className="rounded-full p-1.5 flex-shrink-0 animate-scale-in"
                                  style={{
                                    background: 'linear-gradient(135deg, hsl(0 64% 62%), hsl(0 64% 52%))',
                                    boxShadow: '0 4px 12px rgba(212,49,49,0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                  }}
                                >
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </div>
                            {service.descricao && (
                              <p className="text-sm text-muted-foreground leading-relaxed mb-3 responsive-text font-light">
                                {service.descricao}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm responsive-text">
                              <span className="flex items-center gap-2 text-muted-foreground font-medium">
                                <Clock className="w-4 h-4" />
                                {service.duracao_minutos} min
                              </span>
                              <span className="font-bold text-base" style={{ 
                                color: 'hsl(0 64% 52%)',
                                textShadow: '0 2px 8px rgba(212, 49, 49, 0.3)'
                              }}>
                                R$ {service.preco.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fixed CTA Button - Premium Footer */}
              {selectedServices.length > 0 && (
                <div className="flex-shrink-0 p-4 border-t-0">
                  <div className="max-w-4xl mx-auto space-y-3 animate-fade-in">
                    {/* Premium Summary Card */}
                    <div className="glass-card p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-sm font-light text-muted-foreground">
                            {selectedServices.length} {selectedServices.length === 1 ? 'serviço selecionado' : 'serviços selecionados'}
                          </p>
                          <p className="text-xs text-muted-foreground font-light">
                            Duração total: {getTotalDuration()} minutos
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground font-light mb-1">Total</p>
                          <p className="text-2xl font-bold tracking-tight" style={{ 
                            color: 'hsl(0 64% 52%)',
                            textShadow: '0 2px 12px rgba(212, 49, 49, 0.4)'
                          }}>
                            R$ {getTotalPrice().toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Premium CTA Button */}
                    <Button
                      onClick={() => setStep(2)}
                      className="relative w-full h-14 font-bold text-base tracking-wide overflow-hidden group ripple"
                      style={{
                        background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                        boxShadow: '0 8px 24px rgba(212, 49, 49, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      {/* Animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <span className="relative">Continuar</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

        {/* Step 2: Select Date */}
        {step === 2 && (
          <div className="scrollable-content p-4 md:p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              <div>
                <h3 className="text-sm font-semibold mb-1">Etapa {activeSubscription?.servico ? '1' : '2'} de {activeSubscription?.servico ? '4' : '5'}</h3>
                <h2 className="text-xl font-bold mb-3 responsive-title">Escolha a Data</h2>
                <p className="text-sm text-muted-foreground mb-4 responsive-text">
                  Selecione o dia desejado para o atendimento
                </p>
              </div>

              {/* NOVO: Card do Plano para Assinantes */}
              {activeSubscription?.servico && (
                <div className="glass-card p-4 border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-400">{activeSubscription.plano_nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Serviço: <span className="text-foreground font-medium">{activeSubscription.servico.nome}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">
                        {activeSubscription.limite_agendamentos_mes - activeSubscription.agendamentos_usados}
                      </p>
                      <p className="text-xs text-muted-foreground">restantes</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Usados este mês: {activeSubscription.agendamentos_usados}/{activeSubscription.limite_agendamentos_mes}</span>
                      <span className="text-green-400">R$ 0,00</span>
                    </div>
                  </div>
                </div>
              )}

              <Card className="p-4 card-premium flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const compareDate = new Date(date);
                    compareDate.setHours(0, 0, 0, 0);
                    // Permitir hoje e dias futuros, bloquear domingos
                    return compareDate < today || date.getDay() === 0;
                  }}
                  className="rounded-md pointer-events-auto"
                />
              </Card>

              <Button
                onClick={handleNextStep}
                disabled={!selectedDate}
                className="w-full touch-target font-semibold responsive-button"
                style={{
                  background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                  minHeight: '44px'
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Select Time - Premium Design */}
        {step === 3 && (
          <div className="scrollable-content p-4 md:p-6">
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Premium Header */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 mb-4 shadow-[0_0_30px_rgba(255,59,59,0.3)]">
                  <Clock className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1 text-muted-foreground">
                  Etapa {activeSubscription?.servico ? '2' : '3'} de {activeSubscription?.servico ? '4' : '5'}
                </h3>
                <h2 className="text-2xl font-bold mb-2 responsive-title">Escolha o Horário</h2>
                <p className="text-sm text-muted-foreground responsive-text">
                  {selectedDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
              </div>

              {loadingSlots ? (
                <Card className="glass-card p-8 text-center">
                  <div className="animate-pulse space-y-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto flex items-center justify-center">
                      <Clock className="w-6 h-6 text-primary animate-spin" />
                    </div>
                    <p className="text-sm text-muted-foreground">Carregando horários disponíveis...</p>
                  </div>
                </Card>
              ) : availableSlots.filter(slot => slot.available).length === 0 ? (
                <Card className="glass-card p-8 text-center">
                  <div className="text-4xl mb-4">😔</div>
                  <p className="text-muted-foreground font-medium mb-4">
                    Agenda cheia neste dia.
                  </p>
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Escolher outra data
                  </Button>
                </Card>
              ) : (
                <>
                  {/* Premium Time Slots Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      const isUnavailable = !slot.available;
                      
                      return (
                        <button
                          key={slot.time}
                          onClick={() => {
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
                          disabled={isUnavailable}
                          className={cn(
                            "relative h-12 rounded-xl font-semibold text-sm transition-all duration-300",
                            isUnavailable && "opacity-30 cursor-not-allowed bg-white/[0.02] border border-white/[0.05] text-muted-foreground/50",
                            !isUnavailable && !isSelected && "bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-primary/30 hover:shadow-[0_0_15px_rgba(255,59,59,0.15)]",
                            isSelected && "bg-primary text-primary-foreground border-0 shadow-[0_0_25px_rgba(255,59,59,0.5)]"
                          )}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
                          )}
                          <span className="relative">{slot.time}</span>
                        </button>
                      );
                    })}
                  </div>

                  {unavailableMessage && (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center animate-fade-in">
                      <p className="text-sm text-destructive font-medium">{unavailableMessage}</p>
                    </div>
                  )}

                  {/* Selected Time Preview */}
                  {selectedTime && (
                    <div className="glass-card p-4 border border-primary/20 bg-primary/5 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">Horário selecionado</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedDate?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {selectedTime}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{selectedTime}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Premium CTA Button */}
                  <Button
                    onClick={handleNextStep}
                    disabled={!selectedTime}
                    className="relative w-full h-14 font-bold text-base tracking-wide overflow-hidden group ripple"
                    style={{
                      background: selectedTime 
                        ? 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))' 
                        : 'rgba(255,255,255,0.05)',
                      boxShadow: selectedTime 
                        ? '0 8px 24px rgba(212, 49, 49, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
                        : 'none'
                    }}
                  >
                    {selectedTime && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    )}
                    <span className="relative">Continuar</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Payment Method */}
        {step === 4 && !isRescheduling && (
          <div className="scrollable-content p-4 md:p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              <div>
                <h3 className="text-sm font-semibold mb-1">Etapa 4 de 5</h3>
                <h2 className="text-xl font-bold mb-3 responsive-title">Forma de Pagamento</h2>
                <p className="text-sm text-muted-foreground mb-4 responsive-text">
                  Escolha como deseja pagar
                </p>
              </div>

            <div className="grid gap-3">
              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'pix'
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "card-premium hover:border-primary/50"
                }`}
                onClick={() => setPaymentMethod('pix')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'pix' ? 'border-primary' : 'border-muted'
                  }`}>
                    {paymentMethod === 'pix' && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">PIX</h4>
                    <p className="text-xs text-muted-foreground">
                      Pagamento instantâneo via QR Code
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "card-premium hover:border-primary/50"
                }`}
                onClick={() => setPaymentMethod('card')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'card' ? 'border-primary' : 'border-muted'
                  }`}>
                    {paymentMethod === 'card' && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Cartão de Crédito</h4>
                    <p className="text-xs text-muted-foreground">
                      Pagamento aprovado na hora
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'cash'
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "card-premium hover:border-primary/50"
                }`}
                onClick={() => setPaymentMethod('cash')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'cash' ? 'border-primary' : 'border-muted'
                  }`}>
                    {paymentMethod === 'cash' && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Pagar na Barbearia</h4>
                    <p className="text-xs text-muted-foreground">
                      Pagamento presencial após confirmação do barbeiro
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Banner de Resgate Disponível */}
            {canUseRedemption && (
              <Card 
                className={`p-4 cursor-pointer transition-all ${
                  useRedemption 
                    ? "border-green-500 bg-green-500/10 ring-2 ring-green-500" 
                    : "border-amber-500/50 bg-amber-500/10 hover:border-green-500/50"
                }`}
                onClick={() => setUseRedemption(!useRedemption)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    useRedemption ? 'border-green-500' : 'border-amber-500'
                  }`}>
                    {useRedemption && (
                      <Check className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-700 dark:text-amber-400">
                      🎁 Corte Grátis Disponível!
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Você tem {availableRedemptions.length} resgate{availableRedemptions.length > 1 ? 's' : ''} do programa de fidelidade. 
                      {useRedemption ? ' (Aplicado!)' : ' Clique para usar.'}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="space-y-3">
                {/* Preço original */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Valor do serviço:</span>
                  <span className={`font-semibold ${useRedemption && getCorteService() ? 'line-through text-muted-foreground' : ''}`}>
                    R$ {selectedServices.reduce((sum, s) => sum + s.preco, 0).toFixed(2)}
                  </span>
                </div>

                {/* Desconto do resgate */}
                {useRedemption && getRedemptionDiscount() > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600">🎁 Corte grátis (resgate):</span>
                    <span className="font-semibold text-green-600">
                      - R$ {getRedemptionDiscount().toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Créditos */}
                {availableCredits > 0 && getTotalPrice() > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600">Créditos aplicados:</span>
                    <span className="font-semibold text-green-600">
                      - R$ {Math.min(availableCredits, getTotalPrice()).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="border-t border-border/50 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Valor a pagar:</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2)}
                    </span>
                  </div>
                  {getTotalPrice() === 0 && useRedemption && (
                    <p className="text-xs text-green-600 mt-2 text-center">
                      🎉 Seu corte está 100% coberto pelo resgate de fidelidade!
                    </p>
                  )}
                  {getTotalPrice() > 0 && getTotalPrice() <= availableCredits && (
                    <p className="text-xs text-green-600 mt-2 text-center">
                      🎉 Valor restante coberto por créditos!
                    </p>
                  )}
                </div>
              </div>
            </Card>

              <Button
                onClick={() => setStep(5)}
                className="w-full touch-target font-semibold responsive-button"
                style={{
                  background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                  minHeight: '44px'
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Review and Card Details (if card) or Confirm */}
        {step === 5 && !isRescheduling && (
          <div className="scrollable-content p-4 md:p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              <div>
                <h3 className="text-sm font-semibold mb-1">Etapa {isPlanEligible ? '3' : '5'} de {isPlanEligible ? '4' : '5'}</h3>
                <h2 className="text-xl font-bold mb-3 responsive-title">
                  {paymentMethod === 'card' ? 'Dados do Cartão' : 'Confirmar Agendamento'}
                </h2>
              </div>

            <Card className="p-6 space-y-4 card-premium">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Serviços:</span>
                  <span className="font-semibold text-right">
                    {selectedServices.map(s => s.nome).join(", ")}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-semibold">
                    {selectedDate?.toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Horário:</span>
                  <span className="font-semibold">{selectedTime}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Forma de Pagamento:</span>
                  <span className="font-semibold">
                    {isPlanEligible
                      ? `Plano (${activeSubscription?.plano_nome})`
                      : availableCredits >= getTotalPrice()
                        ? 'Crédito do App'
                        : paymentMethod === 'pix'
                          ? 'PIX'
                          : paymentMethod === 'card'
                            ? 'Cartão de Crédito'
                            : 'Dinheiro (na barbearia)'
                    }
                  </span>
                </div>
                
                {/* Resumo de valores com créditos */}
                {availableCredits > 0 ? (
                  <div className="py-3 bg-primary/10 -m-6 mt-2 px-6 rounded-b-lg space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Valor do serviço:</span>
                      <span>R$ {getTotalPrice().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span>Créditos aplicados:</span>
                      <span>- R$ {Math.min(availableCredits, getTotalPrice()).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border/50 pt-2 flex justify-between items-center">
                      <span className="font-semibold">Valor a pagar:</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2)}
                      </span>
                    </div>
                    {getTotalPrice() <= availableCredits && (
                      <p className="text-xs text-green-600 text-center font-medium">
                        Corte 100% coberto por créditos do app
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between items-center py-3 bg-primary/10 -m-6 mt-2 px-6 rounded-b-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {getTotalPrice().toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Card Payment Form */}
            {paymentMethod === 'card' && (
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold mb-4">Informações do Cartão</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nome no Cartão</label>
                    <input
                      type="text"
                      placeholder="Como está no cartão"
                      value={cardHolderName}
                      onChange={(e) => setCardHolderName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Número do Cartão</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                        setCardNumber(formatted);
                      }}
                      maxLength={19}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Mês</label>
                      <input
                        type="text"
                        placeholder="MM"
                        value={cardExpiryMonth}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (parseInt(value) <= 12) setCardExpiryMonth(value);
                        }}
                        maxLength={2}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Ano</label>
                      <input
                        type="text"
                        placeholder="AA"
                        value={cardExpiryYear}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setCardExpiryYear(value);
                        }}
                        maxLength={2}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">CVV</label>
                      <input
                        type="text"
                        placeholder="000"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        maxLength={4}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">CPF do Titular</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={cardCpf}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        let formatted = value;
                        if (value.length > 3) formatted = value.slice(0,3) + '.' + value.slice(3);
                        if (value.length > 6) formatted = value.slice(0,3) + '.' + value.slice(3,6) + '.' + value.slice(6);
                        if (value.length > 9) formatted = value.slice(0,3) + '.' + value.slice(3,6) + '.' + value.slice(6,9) + '-' + value.slice(9,11);
                        setCardCpf(formatted);
                      }}
                      maxLength={14}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Message when paying with credits */}
            {!isPlanEligible && availableCredits >= getTotalPrice() && (
              <Card className="p-4 bg-green-500/10 border-green-500/20">
                <p className="text-sm text-center text-green-600 font-medium">
                  Seu agendamento será pago usando seus créditos do app
                </p>
              </Card>
            )}

            {isPlanEligible && (
              <Card className="p-4 bg-green-500/10 border-green-500/20">
                <p className="text-sm text-center text-green-600 font-medium">
                  Este agendamento será registrado como PLANO. Nenhum pagamento será solicitado.
                </p>
              </Card>
            )}

            {!isPlanEligible && paymentMethod === 'pix' && availableCredits < getTotalPrice() && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-sm text-center">
                  Ao confirmar, o QR Code PIX será gerado para pagamento
                </p>
              </Card>
            )}

            {!isPlanEligible && paymentMethod === 'cash' && availableCredits < getTotalPrice() && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-sm text-center">
                  Você pagará diretamente na barbearia no dia do atendimento
                </p>
              </Card>
            )}

              <Button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full responsive-button"
                style={{
                  background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                  minHeight: '44px'
                }}
              >
                {processingPayment 
                  ? "Processando..." 
                  : isPlanEligible
                    ? "Finalizar (usando PLANO)"
                    : availableCredits >= getTotalPrice()
                      ? "Confirmar (usando créditos)"
                      : paymentMethod === 'pix' 
                        ? "Gerar QR Code" 
                        : "Confirmar Agendamento"
                }
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Reschedule Confirmation */}
        {step === 5 && isRescheduling && (
          <div className="scrollable-content p-4 md:p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              <div>
                <h3 className="text-sm font-semibold mb-1">Confirmar Remarcação</h3>
                <h2 className="text-xl font-bold mb-3 responsive-title">Revise os novos dados</h2>
              </div>

              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium responsive-text">Nova Data e Horário</p>
                    <p className="text-sm text-muted-foreground responsive-text">
                      {selectedDate?.toLocaleDateString('pt-BR')} às {selectedTime}
                    </p>
                  </div>
                </div>
                
                {selectedServices[0] && (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium responsive-text">Serviço</p>
                      <p className="text-sm text-muted-foreground responsive-text">{selectedServices[0].nome}</p>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-primary/10 rounded-md text-sm responsive-text compact-padding">
                  ℹ️ O pagamento existente permanecerá válido
                </div>
              </Card>

              <Button
                onClick={handleRescheduleUpdate}
                disabled={processingPayment}
                className="w-full responsive-button"
                style={{
                  background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                  minHeight: '44px'
                }}
              >
                {processingPayment ? "Remarcando..." : "Confirmar Remarcação"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: PIX QR Code Display */}
        {step === 6 && pixQrCode && (
          <div className="scrollable-content p-4 md:p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
            {paymentConfirmed ? (
              // Payment Confirmed View
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                      <Check className="w-10 h-10 text-green-500" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-foreground">Pagamento realizado com sucesso!</h2>
                  <p className="text-muted-foreground mb-4">
                    Seu agendamento foi confirmado. Você será redirecionado automaticamente...
                  </p>
                </div>

                <Button
                  onClick={() => navigate("/cliente")}
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
                >
                  Ir para tela inicial
                </Button>
              </div>
            ) : (
              // QR Code View
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Pagamento PIX</h3>
                  <h2 className="text-xl font-bold mb-3">Escaneie o QR Code</h2>
                </div>

                <Card className="p-6 text-center space-y-4">
                  <div className="bg-primary/10 p-4 rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Valor a pagar</p>
                    <p className="text-3xl font-bold text-primary">
                      R$ {getTotalPrice().toFixed(2)}
                    </p>
                  </div>

                  <p className="text-muted-foreground mb-4">
                    Abra o app do seu banco e escaneie o código abaixo para pagar
                  </p>
                  
                  {/* QR Code com visual premium - sem fundo branco */}
                  <div className="flex justify-center">
                    <div 
                      className="relative p-4 rounded-2xl"
                      style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,248,248,0.98))',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
                      }}
                    >
                      {/* Borda decorativa com gradiente */}
                      <div 
                        className="absolute inset-0 rounded-2xl opacity-30"
                        style={{
                          background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                          padding: '2px',
                          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          maskComposite: 'exclude',
                          WebkitMaskComposite: 'xor',
                        }}
                      />
                      <img 
                        src={`data:image/png;base64,${pixQrCode}`} 
                        alt="QR Code PIX" 
                        className="w-56 h-56 md:w-64 md:h-64 relative z-10"
                        style={{
                          filter: 'contrast(1.1)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Indicador de aguardando sem emoji */}
                  <div className="flex items-center justify-center gap-2 py-3">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-sm text-muted-foreground animate-pulse">
                      Aguardando confirmação do pagamento...
                    </span>
                  </div>

                  {pixPayload && (
                    <div className="mt-6 space-y-4">
                      <p className="text-base font-semibold text-foreground">Ou copie o código PIX</p>
                      
                      {/* PIX Code Display */}
                      <div className="bg-muted/50 backdrop-blur-sm p-4 rounded-xl border border-border/50">
                        <p className="text-xs text-muted-foreground mb-2 font-mono break-all">
                          {pixPayload}
                        </p>
                      </div>

                      {/* Copy Button - Large and Prominent */}
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(pixPayload);
                          toast.success("Código PIX copiado!");
                        }}
                        className="w-full h-14 text-base font-semibold"
                        style={{
                          background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                          boxShadow: '0 4px 20px rgba(217, 65, 65, 0.3)'
                        }}
                      >
                        <Copy className="w-5 h-5 mr-2" />
                        Copiar Código PIX
                      </Button>
                      
                      <p className="text-xs text-muted-foreground text-center">
                        Toque no botão acima para copiar o código automaticamente
                      </p>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ClienteAgendar;
