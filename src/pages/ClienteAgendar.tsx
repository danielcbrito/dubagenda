import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";

interface Service {
  id: string;
  nome: string;
  descricao: string;
  duracao_minutos: number;
  preco: number;
}

const ClienteAgendar = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const { data } = await supabase
      .from("servicos")
      .select("*")
      .eq("ativo", true)
      .order("preco");

    setServices(data || []);
  };

  const availableTimes = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00"
  ];

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      toast.error("Selecione serviço, data e horário");
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

      const { error } = await supabase
        .from("agendamentos")
        .insert({
          user_id: session.user.id,
          servico_id: selectedService.id,
          data: selectedDate.toISOString().split('T')[0],
          hora: selectedTime,
          duracao: selectedService.duracao_minutos,
          preco: selectedService.preco,
          status: "pending",
        });

      if (error) throw error;

      toast.success("Agendamento realizado com sucesso!");
      navigate("/cliente");
    } catch (error: any) {
      toast.error("Erro ao agendar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cliente")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">Agendar Horário</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Step 1: Select Service */}
        <div>
          <h3 className="text-sm font-semibold mb-3">1. Escolha o Serviço</h3>
          <div className="grid gap-3">
            {services.map((service) => (
              <Card
                key={service.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedService?.id === service.id
                    ? "border-primary bg-primary/5"
                    : "card-premium hover:border-primary/50"
                }`}
                onClick={() => setSelectedService(service)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{service.nome}</h4>
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
            ))}
          </div>
        </div>

        {/* Step 2: Select Date */}
        {selectedService && (
          <div>
            <h3 className="text-sm font-semibold mb-3">2. Escolha a Data</h3>
            <Card className="p-4 card-premium flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                className="rounded-md"
              />
            </Card>
          </div>
        )}

        {/* Step 3: Select Time */}
        {selectedService && selectedDate && (
          <div>
            <h3 className="text-sm font-semibold mb-3">3. Escolha o Horário</h3>
            <div className="grid grid-cols-3 gap-2">
              {availableTimes.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "default" : "outline"}
                  onClick={() => setSelectedTime(time)}
                  className="h-12"
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Confirm Button */}
        {selectedService && selectedDate && selectedTime && (
          <Button
            onClick={handleBooking}
            disabled={loading}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
          >
            {loading ? "Agendando..." : "Confirmar Agendamento"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ClienteAgendar;
