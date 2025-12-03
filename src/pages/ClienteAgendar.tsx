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

interface Service {
  id: string;
  nome: string;
  descricao: string;
  duracao_minutos: number;
  preco: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  blockedReason?: 'occupied' | 'minimum_advance'; // Motivo do bloqueio
}

const ClienteAgendar = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
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

  useEffect(() => {
    loadServices();
    loadUserCredits();
    
    // Check if resuming payment from pending booking
    const resumeBookingId = sessionStorage.getItem('resumePendingBookingId');
    if (resumeBookingId) {
      setResumePendingBookingId(resumeBookingId);
      sessionStorage.removeItem('resumePendingBookingId');
      loadPendingBookingDetails(resumeBookingId);
    }
    
    // Check if rescheduling an existing appointment
    const isReschedulingSession = sessionStorage.getItem('isRescheduling');
    const appointmentId = sessionStorage.getItem('rescheduleAppointmentId');
    
    if (isReschedulingSession === 'true' && appointmentId) {
      setIsRescheduling(true);
      setRescheduleAppointmentId(appointmentId);
      loadAppointmentForReschedule(appointmentId);
    }
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

  useEffect(() => {
    if (selectedDate && selectedServices.length > 0) {
      loadAvailableSlots();
      setUnavailableMessage(null); // Limpar mensagem ao mudar data
    }
  }, [selectedDate, selectedServices]);

  // Realtime listener para atualizar slots quando agendamentos mudam
  useEffect(() => {
    if (!selectedDate || selectedServices.length === 0) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Canal para monitorar mudanças em agendamentos
    const appointmentsChannel = supabase
      .channel(`agendamentos-slots-${dateStr}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'agendamentos',
          filter: `data=eq.${dateStr}`
        },
        (payload) => {
          console.log('[Realtime] Agendamento alterado:', payload);
          // Recarregar slots quando qualquer agendamento for alterado
          loadAvailableSlots();
        }
      )
      .subscribe();

    // Canal para monitorar mudanças em pending_bookings
    const pendingChannel = supabase
      .channel(`pending-bookings-slots-${dateStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_bookings',
          filter: `data=eq.${dateStr}`
        },
        (payload) => {
          console.log('[Realtime] Pending booking alterado:', payload);
          loadAvailableSlots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(pendingChannel);
    };
  }, [selectedDate, selectedServices]);

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
        toast.error("Reserva não encontrada");
        return;
      }

      // Set booking details
      setSelectedServices([booking.servico]);
      setSelectedDate(new Date(`${booking.data}T12:00:00`));
      setSelectedTime(booking.hora);
      setStep(4); // Go directly to payment
      toast.info("Continue o pagamento do seu agendamento");
    } catch (error) {
      console.error("Error loading pending booking:", error);
      toast.error("Erro ao carregar reserva");
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

  const loadAvailableSlots = async () => {
    if (!selectedDate) return;

    // Format date without timezone conversion to avoid day shifting
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isToday = dateStr === todayStr;
    
    // Calculate minimum allowed time (now + 1 hour) for same-day bookings
    const now = new Date();
    const minimumAllowedMinutes = isToday 
      ? (now.getHours() * 60 + now.getMinutes() + 60) // +60 minutos = 1 hora de antecedência
      : 0;
    
    console.log('[loadAvailableSlots] isToday:', isToday, 'minimumAllowedMinutes:', minimumAllowedMinutes, '(' + Math.floor(minimumAllowedMinutes / 60) + ':' + (minimumAllowedMinutes % 60).toString().padStart(2, '0') + ')');
    
    // Fetch all appointments for the selected date (exclude cancelled and no_show)
    const { data: appointments } = await supabase
      .from("agendamentos")
      .select("hora, duracao")
      .eq("data", dateStr)
      .in("status", ["pending", "confirmed", "completed"]);

    // Also fetch pending bookings (reservas aguardando pagamento)
    const { data: pendingBookings } = await supabase
      .from("pending_bookings")
      .select("hora, duracao, expires_at")
      .eq("data", dateStr)
      .gt("expires_at", new Date().toISOString());

    // Combine appointments and pending bookings for conflict check
    const allOccupiedSlots = [
      ...(appointments || []),
      ...(pendingBookings || []).map(pb => ({ hora: pb.hora, duracao: pb.duracao }))
    ];

    console.log('[loadAvailableSlots] Data:', dateStr, 'Appointments:', appointments?.length, 'PendingBookings:', pendingBookings?.length);

    // Calculate total duration needed
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
    const bufferTime = 10; // 10-minute buffer between appointments

    // Generate time slots from 9:00 to 20:00
    const slots: TimeSlot[] = [];
    const startHour = 9;
    const endHour = 20;
    const lunchStart = 13 * 60; // 13:00 = 780 minutes
    const lunchEnd = 14 * 60; // 14:00 = 840 minutes

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotStart = hour * 60 + minute; // Convert to minutes
        const slotEnd = slotStart + totalDuration;

        // Check if slot would extend past closing time - still skip these
        if (slotEnd > endHour * 60) {
          continue;
        }

        // Check if slot is during lunch break - still skip these
        if (
          (slotStart >= lunchStart && slotStart < lunchEnd) ||
          (slotEnd > lunchStart && slotEnd <= lunchEnd) ||
          (slotStart < lunchStart && slotEnd > lunchEnd)
        ) {
          continue;
        }

        // Check minimum advance time for same-day bookings (1 hour)
        if (isToday && slotStart < minimumAllowedMinutes) {
          slots.push({ time, available: false, blockedReason: 'minimum_advance' });
          continue;
        }

        // Check if slot conflicts with existing appointments or pending bookings (including buffer)
        let isAvailable = true;
        
        if (allOccupiedSlots.length > 0) {
          for (const apt of allOccupiedSlots) {
            const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
            const aptStart = aptHour * 60 + aptMinute;
            const aptEnd = aptStart + apt.duracao + bufferTime; // Add buffer after appointment

            // Check for overlap (including buffer time)
            if (
              (slotStart >= aptStart && slotStart < aptEnd) ||
              (slotEnd > aptStart && slotEnd <= aptEnd) ||
              (slotStart <= aptStart && slotEnd >= aptEnd)
            ) {
              isAvailable = false;
              console.log('[loadAvailableSlots] Slot', time, 'BLOQUEADO por agendamento às', apt.hora);
              break;
            }
          }
        }

        slots.push({ time, available: isAvailable, blockedReason: isAvailable ? undefined : 'occupied' });
      }
    }

    console.log('[loadAvailableSlots] Total slots:', slots.length, 'Indisponíveis:', slots.filter(s => !s.available).length);
    setAvailableSlots(slots);
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
    
    // If rescheduling and in step 3 (time selection), skip to confirmation
    if (isRescheduling && step === 3) {
      setStep(5); // Go to confirmation step for reschedule
      return;
    }
    
    setStep(step + 1);
  };

  // Removed createAppointment - now happens during payment

  const handlePayment = async () => {
    if (!selectedDate || !selectedTime || selectedServices.length === 0) {
      toast.error("Dados do agendamento inválidos");
      return;
    }

    const totalPrice = getTotalPrice();
    const finalPrice = Math.max(0, totalPrice - availableCredits);

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

      // Handle response based on payment method
      if (paymentMethod === 'cash') {
        // Clear rescheduling session data
        sessionStorage.removeItem('isRescheduling');
        sessionStorage.removeItem('rescheduleAppointmentId');
        
        toast.success("Agendamento criado! Pague na barbearia.");
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
        loadAvailableSlots();
      } else {
        toast.error("Erro ao processar pagamento: " + (error.message || "Erro desconhecido"));
      }
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
        loadAvailableSlots();
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
          observacoes: selectedServices.length > 1 ? `Serviços: ${serviceNames}` : undefined,
          payment_method: 'cash', // Mark as cash since paid with credits
          is_free: true, // Mark as free (using credits/redemption)
          remarcado_de: isRescheduling ? rescheduleAppointmentId : null,
          barbeiro_confirmou: false, // Reset barber confirmation for rescheduled appointments
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

      // Clear rescheduling session data
      sessionStorage.removeItem('isRescheduling');
      sessionStorage.removeItem('rescheduleAppointmentId');

      toast.success("Agendamento criado! Créditos aplicados com sucesso.");
      navigate("/cliente");
    } catch (error: any) {
      console.error('Error creating appointment with credits:', error);
      toast.error("Erro ao criar agendamento: " + (error.message || "Erro desconhecido"));
    } finally {
      setProcessingPayment(false);
    }
  };

  const useCredits = async (amount: number, appointmentId: string) => {
    if (!userId) return;

    try {
      // Get available credits
      const { data: credits, error: fetchError } = await supabase
        .from("creditos")
        .select("*")
        .eq("user_id", userId)
        .eq("usado", false)
        .is("expires_at", null)
        .or(`expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      let remaining = amount;
      const creditIdsToUse: string[] = [];

      // Mark credits as used
      for (const credit of credits || []) {
        if (remaining <= 0) break;
        
        creditIdsToUse.push(credit.id);
        remaining -= credit.valor;
      }

      if (creditIdsToUse.length > 0) {
        const { error: updateError } = await supabase
          .from("creditos")
          .update({ 
            usado: true,
            agendamento_usado_id: appointmentId
          })
          .in("id", creditIdsToUse);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error("Error using credits:", error);
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
        loadAvailableSlots();
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

  const getTotalPrice = () => {
    return selectedServices.reduce((sum, s) => sum + s.preco, 0);
  };

  const progressValue = (step / 6) * 100;

  return (
    <div
      className="h-screen w-full flex flex-col bg-background overflow-hidden"
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* Header Premium - No divider line */}
      <div className="glass-card rounded-none border-0 border-b border-white/5 p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => step === 1 ? navigate("/cliente") : setStep(step - 1)} 
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
                <h3 className="text-sm font-semibold mb-1">Etapa 2 de 5</h3>
                <h2 className="text-xl font-bold mb-3 responsive-title">Escolha a Data</h2>
                <p className="text-sm text-muted-foreground mb-4 responsive-text">
                  Selecione o dia desejado para o atendimento
                </p>
              </div>

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

        {/* Step 3: Select Time */}
        {step === 3 && (
          <div className="scrollable-content p-4 md:p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              <div>
                <h3 className="text-sm font-semibold mb-1">Etapa 3 de 5</h3>
                <h2 className="text-xl font-bold mb-3 responsive-title">Escolha o Horário</h2>
                <p className="text-sm text-muted-foreground mb-4 responsive-text">
                  Horários disponíveis para {selectedDate?.toLocaleDateString('pt-BR')}
                </p>
              </div>

              {availableSlots.filter(slot => slot.available).length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    😔 Agenda cheia neste dia. Tente outra data.
                  </p>
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="mt-4"
                  >
                    Escolher outra data
                  </Button>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={selectedTime === slot.time ? "default" : "outline"}
                        onClick={() => {
                          if (slot.available) {
                            setSelectedTime(slot.time);
                            setUnavailableMessage(null);
                          } else {
                            // Mensagem específica baseada no motivo do bloqueio
                            if (slot.blockedReason === 'minimum_advance') {
                              setUnavailableMessage("Este horário não pode ser agendado. É necessário 1 hora de antecedência.");
                            } else {
                              setUnavailableMessage("Este horário já foi agendado.");
                            }
                          }
                        }}
                        className={cn(
                          "h-11 responsive-button transition-all",
                          !slot.available && "opacity-30 cursor-not-allowed bg-muted/20 border-muted/30 text-muted-foreground/50 hover:bg-muted/20 hover:text-muted-foreground/50",
                          slot.available && selectedTime !== slot.time && "hover:border-primary/50"
                        )}
                      >
                        {slot.time}
                      </Button>
                    ))}
                  </div>

                  {unavailableMessage && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                      <p className="text-sm text-destructive font-medium">{unavailableMessage}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleNextStep}
                    disabled={!selectedTime}
                    className="w-full touch-target font-semibold responsive-button"
                    style={{
                      background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                      minHeight: '44px'
                    }}
                  >
                    Continuar
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

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Valor do serviço:</span>
                  <span className="font-semibold">R$ {getTotalPrice().toFixed(2)}</span>
                </div>

                {availableCredits > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-600">Créditos aplicados:</span>
                      <span className="font-semibold text-green-600">
                        - R$ {Math.min(availableCredits, getTotalPrice()).toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-border/50 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Valor a pagar:</span>
                        <span className="text-2xl font-bold text-primary">
                          R$ {Math.max(0, getTotalPrice() - availableCredits).toFixed(2)}
                        </span>
                      </div>
                      {getTotalPrice() <= availableCredits && (
                        <p className="text-xs text-green-600 mt-2 text-center">
                          🎉 Seu corte está 100% coberto por créditos!
                        </p>
                      )}
                    </div>
                  </>
                )}

                {availableCredits === 0 && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Valor Total:</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {getTotalPrice().toFixed(2)}
                    </span>
                  </div>
                )}
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
                <h3 className="text-sm font-semibold mb-1">Etapa 5 de 5</h3>
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
                    {paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão de Crédito' : 'Dinheiro (na barbearia)'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-primary/10 -m-6 mt-2 px-6 rounded-b-lg">
                  <span className="font-semibold">Total:</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {getTotalPrice().toFixed(2)}
                  </span>
                </div>
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

            {paymentMethod === 'pix' && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-sm text-center">
                  Ao confirmar, o QR Code PIX será gerado para pagamento
                </p>
              </Card>
            )}

            {paymentMethod === 'cash' && (
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
                {processingPayment ? "Processando..." : paymentMethod === 'pix' ? "Gerar QR Code" : "Confirmar Agendamento"}
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
                  
                  <div className="flex justify-center bg-white p-6 rounded-lg border-2 border-border">
                    <img 
                      src={`data:image/png;base64,${pixQrCode}`} 
                      alt="QR Code PIX" 
                      className="w-64 h-64" 
                    />
                  </div>

                  <div className="animate-pulse text-sm text-muted-foreground py-2">
                    ⏳ Aguardando confirmação do pagamento...
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
