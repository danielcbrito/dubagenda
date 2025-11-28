import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

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

  useEffect(() => {
    if (selectedDate && selectedServices.length > 0) {
      loadAvailableSlots();
    }
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
      setSelectedDate(new Date(booking.data));
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

    const dateStr = selectedDate.toISOString().split('T')[0];
    
    // Fetch all appointments for the selected date (exclude cancelled and no_show)
    const { data: appointments } = await supabase
      .from("agendamentos")
      .select("hora, duracao")
      .eq("data", dateStr)
      .in("status", ["pending", "confirmed", "completed"]);

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

        // Check if slot would extend past closing time
        if (slotEnd > endHour * 60) {
          continue;
        }

        // Block lunch break (13:00-14:00)
        // Skip if slot starts, ends, or overlaps with lunch break
        if (
          (slotStart >= lunchStart && slotStart < lunchEnd) ||
          (slotEnd > lunchStart && slotEnd <= lunchEnd) ||
          (slotStart < lunchStart && slotEnd > lunchEnd)
        ) {
          continue;
        }

        // Check if slot conflicts with existing appointments (including buffer)
        let isAvailable = true;
        
        if (appointments) {
          for (const apt of appointments) {
            const aptHour = parseInt(apt.hora.split(':')[0]);
            const aptMinute = parseInt(apt.hora.split(':')[1]);
            const aptStart = aptHour * 60 + aptMinute;
            const aptEnd = aptStart + apt.duracao + bufferTime; // Add buffer after appointment

            // Check for overlap (including buffer time)
            if (
              (slotStart >= aptStart && slotStart < aptEnd) ||
              (slotEnd > aptStart && slotEnd <= aptEnd) ||
              (slotStart <= aptStart && slotEnd >= aptEnd)
            ) {
              isAvailable = false;
              break;
            }
          }
        }

        slots.push({ time, available: isAvailable });
      }
    }

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
        data: selectedDate.toISOString().split('T')[0],
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
      toast.error("Erro ao processar pagamento: " + (error.message || "Erro desconhecido"));
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
          data: selectedDate!.toISOString().split('T')[0],
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
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
      
      // UPDATE the existing appointment
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data: selectedDate.toISOString().split('T')[0],
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10 backdrop-blur-lg bg-card/80">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate("/cliente") : setStep(step - 1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">Agendar Horário</h1>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Step 1: Select Services */}
        {step === 1 && (
          <div className="space-y-4 pb-24">
            <div>
              <h3 className="text-sm font-semibold mb-1 text-muted-foreground">Etapa 1 de 5</h3>
              <h2 className="text-2xl font-bold mb-2">Escolha os Serviços</h2>
              <p className="text-sm text-muted-foreground">
                Selecione um ou mais serviços
              </p>
            </div>
            
            <div className="grid gap-3">
              {services.map((service) => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                return (
                  <Card
                    key={service.id}
                    className={`service-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleService(service)}
                    style={{ minHeight: '100px' }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-base">{service.nome}</h4>
                          {isSelected && (
                            <div 
                              className="rounded-full p-1.5 flex-shrink-0"
                              style={{
                                background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                                boxShadow: '0 2px 8px rgba(212,49,49,0.3)'
                              }}
                            >
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        {service.descricao && (
                          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                            {service.descricao}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {service.duracao_minutos} min
                          </span>
                          <span className="font-bold text-base" style={{ color: 'hsl(0 64% 52%)' }}>
                            R$ {service.preco.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Sticky CTA */}
            {selectedServices.length > 0 && (
              <div className="sticky-cta">
                <Card className="p-4 mb-3" style={{
                  background: 'linear-gradient(135deg, hsl(0 64% 52% / 0.1), hsl(0 64% 42% / 0.05))',
                  border: '1px solid hsl(0 64% 52% / 0.3)'
                }}>
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-semibold text-foreground">
                        {selectedServices.length} {selectedServices.length === 1 ? 'serviço' : 'serviços'}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {getTotalDuration()} minutos
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl" style={{ color: 'hsl(0 64% 52%)' }}>
                        R$ {getTotalPrice().toFixed(2)}
                      </div>
                    </div>
                  </div>
                </Card>
                <Button
                  onClick={handleNextStep}
                  className="w-full touch-target font-semibold text-base"
                  style={{
                    background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                    boxShadow: '0 4px 12px rgba(212,49,49,0.3)',
                    minHeight: '52px'
                  }}
                >
                  Escolher Data e Horário
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Date */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Etapa 2 de 5</h3>
              <h2 className="text-xl font-bold mb-3">Escolha a Data</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione o dia desejado para o atendimento
              </p>
            </div>

            <Card className="p-4 card-premium flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                className="rounded-md pointer-events-auto"
              />
            </Card>

            <Button
              onClick={handleNextStep}
              disabled={!selectedDate}
              className="w-full touch-target font-semibold"
              style={{
                background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                minHeight: '52px'
              }}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 3: Select Time */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Etapa 3 de 5</h3>
              <h2 className="text-xl font-bold mb-3">Escolha o Horário</h2>
              <p className="text-sm text-muted-foreground mb-4">
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
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`h-12 ${!slot.available ? 'opacity-40' : ''}`}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={handleNextStep}
                  disabled={!selectedTime}
                  className="w-full touch-target font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                    minHeight: '52px'
                  }}
                >
                  Continuar
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Payment Method */}
        {step === 4 && !isRescheduling && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Etapa 4 de 5</h3>
              <h2 className="text-xl font-bold mb-3">Forma de Pagamento</h2>
              <p className="text-sm text-muted-foreground mb-4">
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
              className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 5: Review and Card Details (if card) or Confirm */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Etapa 5 de 5</h3>
              <h2 className="text-xl font-bold mb-3">
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
              className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
            >
              {processingPayment ? "Processando..." : paymentMethod === 'pix' ? "Gerar QR Code" : "Confirmar Agendamento"}
            </Button>
          </div>
        )}

        {/* Step 5: Reschedule Confirmation */}
        {step === 5 && isRescheduling && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Confirmar Remarcação</h3>
              <h2 className="text-xl font-bold mb-3">Revise os novos dados</h2>
            </div>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Nova Data e Horário</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedDate?.toLocaleDateString('pt-BR')} às {selectedTime}
                  </p>
                </div>
              </div>
              
              {selectedServices[0] && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Serviço</p>
                    <p className="text-sm text-muted-foreground">{selectedServices[0].nome}</p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-primary/10 rounded-md text-sm">
                ℹ️ O pagamento existente permanecerá válido
              </div>
            </Card>

            <Button
              onClick={handleRescheduleUpdate}
              disabled={processingPayment}
              className="w-full h-14"
            >
              {processingPayment ? "Remarcando..." : "Confirmar Remarcação"}
            </Button>
          </div>
        )}

        {/* Step 6: PIX QR Code Display */}
        {step === 6 && pixQrCode && (
          <div className="space-y-4">
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
                    <div className="mt-6 space-y-2">
                      <p className="text-sm font-semibold">Ou copie o código PIX</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={pixPayload}
                          readOnly
                          className="flex-1 px-4 py-2 text-sm bg-muted rounded-lg border"
                        />
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(pixPayload);
                            toast.success("Código copiado!");
                          }}
                          variant="outline"
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClienteAgendar;
