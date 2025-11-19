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

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (selectedDate && selectedServices.length > 0) {
      loadAvailableSlots();
    }
  }, [selectedDate, selectedServices]);

  const loadServices = async () => {
    const { data } = await supabase
      .from("servicos")
      .select("*")
      .eq("ativo", true)
      .order("preco");

    setServices(data || []);
  };

  const loadAvailableSlots = async () => {
    if (!selectedDate) return;

    const dateStr = selectedDate.toISOString().split('T')[0];
    
    // Fetch all appointments for the selected date
    const { data: appointments } = await supabase
      .from("agendamentos")
      .select("hora, duracao")
      .eq("data", dateStr)
      .in("status", ["pending", "confirmed"]);

    // Calculate total duration needed
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
    const bufferTime = 10; // 10-minute buffer between appointments

    // Generate time slots from 9:00 to 20:00
    const slots: TimeSlot[] = [];
    const startHour = 9;
    const endHour = 20;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotStart = hour * 60 + minute; // Convert to minutes
        const slotEnd = slotStart + totalDuration;

        // Check if slot would extend past closing time
        if (slotEnd > endHour * 60) {
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
    
    // If moving from step 3 to 4, create the appointment first
    if (step === 3) {
      await createAppointment();
    } else {
      setStep(step + 1);
    }
  };

  const createAppointment = async () => {
    if (!selectedDate || !selectedTime || selectedServices.length === 0) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);
      const totalPrice = selectedServices.reduce((sum, s) => sum + s.preco, 0);
      const serviceNames = selectedServices.map(s => s.nome).join(", ");

      // Validate appointment with backend
      const { data: validation } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: selectedDate.toISOString().split('T')[0],
          hora: selectedTime,
          duracao: totalDuration,
          userId: session.user.id,
        }
      });

      if (!validation?.valid) {
        toast.error(validation?.message || "Horário indisponível");
        setLoading(false);
        return;
      }

      // Use the first service as the main service for servico_id
      const mainService = selectedServices[0];

      const { error, data: newAppointment } = await supabase
        .from("agendamentos")
        .insert({
          user_id: session.user.id,
          servico_id: mainService.id,
          data: selectedDate.toISOString().split('T')[0],
          hora: selectedTime,
          duracao: totalDuration,
          preco: totalPrice,
          status: "pending",
          observacoes: selectedServices.length > 1 
            ? `Serviços: ${serviceNames}` 
            : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Store appointment ID for payment
      (window as any).currentAppointmentId = newAppointment.id;

      // Sync with Google Calendar
      const dateTime = new Date(`${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`);
      const endDateTime = new Date(dateTime.getTime() + totalDuration * 60000);
      
      await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'create',
          appointmentId: newAppointment.id,
          summary: `Agendamento - ${serviceNames}`,
          description: `Cliente: ${session.user.email}\nServiços: ${serviceNames}\nValor: R$ ${totalPrice.toFixed(2)}`,
          startDateTime: dateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        }
      }).catch(err => {
        console.warn('Google Calendar sync failed:', err);
      });

      setStep(4); // Move to payment step
    } catch (error: any) {
      toast.error("Erro ao criar agendamento: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setProcessingPayment(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const appointmentId = (window as any).currentAppointmentId;
      if (!appointmentId) {
        toast.error("Erro: Agendamento não encontrado");
        return;
      }

      // Call payment function
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          agendamentoId: appointmentId,
          metodo: paymentMethod,
        }
      });

      if (error) throw error;

      if (paymentMethod === 'pix' && data.asaasPayment?.pixQrCode) {
        setPixQrCode(data.asaasPayment.pixQrCode.encodedImage);
        toast.success(data.message);
      } else if (paymentMethod === 'card') {
        toast.success("Pagamento aprovado!");
        navigate("/cliente");
      } else if (paymentMethod === 'cash') {
        toast.success("Agendamento confirmado! Pague na barbearia.");
        navigate("/cliente");
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error("Erro ao processar pagamento: " + error.message);
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

  const progressValue = (step / 5) * 100;

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
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Etapa 1 de 5</h3>
              <h2 className="text-xl font-bold mb-3">Escolha os Serviços</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione um ou mais serviços que deseja realizar
              </p>
            </div>
            
            <div className="grid gap-3">
              {services.map((service) => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                return (
                  <Card
                    key={service.id}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "card-premium hover:border-primary/50"
                    }`}
                    onClick={() => toggleService(service)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{service.nome}</h4>
                          {isSelected && (
                            <div className="bg-primary rounded-full p-1">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {service.descricao}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {service.duracao_minutos} min
                          </span>
                          <span className="text-primary font-semibold">
                            R$ {service.preco.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-semibold">{selectedServices.length} serviço(s) selecionado(s)</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      Tempo total: {getTotalDuration()} min
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-primary">
                      R$ {getTotalPrice().toFixed(2)}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Button
              onClick={handleNextStep}
              disabled={selectedServices.length === 0}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
            >
              Continuar
            </Button>
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
              className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
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
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
                >
                  Continuar
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Payment Method */}
        {step === 4 && (
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
                    <h4 className="font-semibold">Dinheiro</h4>
                    <p className="text-xs text-muted-foreground">
                      Pague na barbearia
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Valor Total:</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {getTotalPrice().toFixed(2)}
                </span>
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

        {/* Step 5: Review and Confirm Payment */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Etapa 5 de 5</h3>
              <h2 className="text-xl font-bold mb-3">Confirmar Pagamento</h2>
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
                    {paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}
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

            {pixQrCode && (
              <Card className="p-6 text-center space-y-4">
                <h3 className="font-semibold">Escaneie o QR Code para pagar</h3>
                <div className="flex justify-center">
                  <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code PIX" className="w-64 h-64" />
                </div>
                <p className="text-xs text-muted-foreground">
                  O pagamento será confirmado automaticamente
                </p>
                <Button
                  onClick={() => navigate("/cliente")}
                  variant="outline"
                  className="w-full"
                >
                  Voltar para Início
                </Button>
              </Card>
            )}

            {!pixQrCode && (
              <Button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
              >
                {processingPayment ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClienteAgendar;
