import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertCircle, Search, User, Clock, DollarSign, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

interface ManualBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  onSuccess: () => void;
}

interface Service {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco: number;
}

interface Client {
  id: string;
  nome: string;
  telefone: string | null;
  cpf: string | null;
}

export function ManualBookingModal({ open, onOpenChange, date, time, onSuccess }: ManualBookingModalProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [manualClientName, setManualClientName] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [observations, setObservations] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open) {
      loadServices();
      loadClients();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredClients([]);
    } else {
      const filtered = clients.filter(
        (c) =>
          c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.telefone?.includes(searchQuery) ||
          c.cpf?.includes(searchQuery)
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

  const resetForm = () => {
    setSelectedClient(null);
    setManualClientName("");
    setSelectedService("");
    setObservations("");
    setValidationError("");
    setSearchQuery("");
    setFilteredClients([]);
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select("id, nome, duracao_minutos, preco")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error("Erro ao carregar serviços");
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, telefone, cpf")
        .order("nome");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Erro ao carregar clientes");
    }
  };

  const validateTimeSlot = async () => {
    const selectedServiceData = services.find((s) => s.id === selectedService);
    if (!selectedServiceData) return false;

    // Validar horário de funcionamento (9h-20h, segunda a sábado)
    const [hours, minutes] = time.split(":").map(Number);
    const timeInMinutes = hours * 60 + minutes;
    const endTimeInMinutes = timeInMinutes + selectedServiceData.duracao_minutos;

    // Horário de almoço: 13:00-14:00
    const lunchStart = 13 * 60;
    const lunchEnd = 14 * 60;

    if (
      (timeInMinutes >= lunchStart && timeInMinutes < lunchEnd) ||
      (endTimeInMinutes > lunchStart && endTimeInMinutes <= lunchEnd) ||
      (timeInMinutes < lunchStart && endTimeInMinutes > lunchEnd)
    ) {
      setValidationError("Horário de almoço (13:00-14:00). A barbearia está fechada.");
      return false;
    }

    // Horário de funcionamento: 9h-20h
    const openHour = 9 * 60;
    const closeHour = 20 * 60;

    if (timeInMinutes < openHour || endTimeInMinutes > closeHour) {
      setValidationError("Fora do horário de funcionamento (09:00-20:00).");
      return false;
    }

    // Verificar domingo
    const appointmentDate = new Date(`${date}T12:00:00`);
    if (appointmentDate.getDay() === 0) {
      setValidationError("A barbearia não funciona aos domingos.");
      return false;
    }

    // Verificar conflitos na agenda
    const { data: existingAppointments, error } = await supabase
      .from("agendamentos")
      .select("hora, duracao")
      .eq("data", date)
      .in("status", ["pending", "confirmed"]);

    if (error) {
      console.error("Error checking conflicts:", error);
      toast.error("Erro ao verificar disponibilidade");
      return false;
    }

    // Verificar sobreposição
    for (const apt of existingAppointments || []) {
      const [aptHour, aptMinute] = apt.hora.split(":").map(Number);
      const aptStart = aptHour * 60 + aptMinute;
      const aptEnd = aptStart + apt.duracao + 10; // Buffer de 10 minutos

      const hasConflict =
        (timeInMinutes >= aptStart && timeInMinutes < aptEnd) ||
        (endTimeInMinutes > aptStart && endTimeInMinutes <= aptEnd) ||
        (timeInMinutes <= aptStart && endTimeInMinutes >= aptEnd);

      if (hasConflict) {
        setValidationError("Horário indisponível. Já existe agendamento nesse período.");
        return false;
      }
    }

    setValidationError("");
    return true;
  };

  const handleSubmit = async () => {
    // Validações
    if (!selectedClient && !manualClientName.trim()) {
      toast.error("Selecione ou digite o nome do cliente");
      return;
    }

    if (!selectedService) {
      toast.error("Selecione um serviço");
      return;
    }

    setLoading(true);

    try {
      // Validar horário
      const isValid = await validateTimeSlot();
      if (!isValid) {
        setLoading(false);
        return;
      }

      const selectedServiceData = services.find((s) => s.id === selectedService);
      if (!selectedServiceData) throw new Error("Serviço não encontrado");

      let clientId = selectedClient?.id;

      // Se cliente digitado manualmente, criar perfil temporário
      if (!selectedClient && manualClientName.trim()) {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.user) throw new Error("Usuário não autenticado");

        // Criar um ID único para cliente manual
        const tempClientId = crypto.randomUUID();
        
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: tempClientId,
            nome: manualClientName.trim(),
            telefone: null,
            cpf: null
          });

        if (profileError) throw profileError;
        clientId = tempClientId;
      }

      if (!clientId) throw new Error("Cliente não definido");

      // Criar agendamento
      const { error: appointmentError } = await supabase
        .from("agendamentos")
        .insert({
          user_id: clientId,
          servico_id: selectedService,
          data: date,
          hora: time + ":00",
          duracao: selectedServiceData.duracao_minutos,
          preco: selectedServiceData.preco,
          status: "confirmed",
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          observacoes: observations.trim() || null,
          tipo_agendamento: "encaixe_manual",
          criado_por: "barbeiro",
          payment_method: "cash"
        });

      if (appointmentError) throw appointmentError;

      toast.success("✅ Encaixe criado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating manual booking:", error);
      toast.error(error.message || "Erro ao criar encaixe");
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceData = services.find((s) => s.id === selectedService);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Calendar className="h-6 w-6 text-primary" />
            Criar Encaixe Manual
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">
              {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { 
                weekday: 'long', 
                day: '2-digit', 
                month: 'long',
                year: 'numeric'
              })}
            </span>
            <span className="mx-2">•</span>
            <Clock className="h-4 w-4" />
            <span className="font-medium">{time}</span>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
          <div className="space-y-6">
            {/* Cliente */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Cliente</Label>
              
              {selectedClient ? (
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{selectedClient.nome}</p>
                          {selectedClient.telefone && (
                            <p className="text-sm text-muted-foreground">{selectedClient.telefone}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedClient(null)}
                      >
                        Trocar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente cadastrado..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-11"
                    />
                  </div>
                  
                  {filteredClients.length > 0 && (
                    <Card>
                      <ScrollArea className="h-[180px]">
                        <div className="p-2 space-y-1">
                          {filteredClients.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => {
                                setSelectedClient(client);
                                setSearchQuery("");
                                setManualClientName("");
                              }}
                              className="w-full text-left p-3 hover:bg-muted rounded-lg transition-all duration-200 flex items-center gap-3"
                            >
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{client.nome}</p>
                                {client.telefone && (
                                  <p className="text-xs text-muted-foreground">{client.telefone}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-3 text-muted-foreground font-medium">ou digite manualmente</span>
                    </div>
                  </div>

                  <Input
                    placeholder="Nome do cliente"
                    value={manualClientName}
                    onChange={(e) => {
                      setManualClientName(e.target.value);
                      setSearchQuery("");
                    }}
                    className="h-11"
                  />
                </div>
              )}
            </div>

            {/* Serviço */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Serviço</Label>
              <div className="grid gap-2">
                {services.map((service) => (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedService === service.id
                        ? 'border-2 border-primary bg-primary/5'
                        : 'border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedService(service.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg mb-2">{service.nome}</h4>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {service.duracao_minutos} min
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              <DollarSign className="h-3 w-3" />
                              R$ {service.preco.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                          selectedService === service.id
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/30'
                        }`}>
                          {selectedService === service.id && (
                            <div className="h-3 w-3 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Resumo do Agendamento */}
            {selectedServiceData && (
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Resumo do Encaixe
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-background rounded-lg">
                      <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-1">Duração</p>
                      <p className="font-bold">{selectedServiceData.duracao_minutos} min</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-lg">
                      <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-1">Preço</p>
                      <p className="font-bold">R$ {selectedServiceData.preco.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-lg">
                      <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-1">Término</p>
                      <p className="font-bold">
                        {(() => {
                          const [h, m] = time.split(":").map(Number);
                          const endMinutes = h * 60 + m + selectedServiceData.duracao_minutos;
                          const endH = Math.floor(endMinutes / 60);
                          const endM = endMinutes % 60;
                          return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Erro de validação */}
            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* Observações */}
            <div className="space-y-3">
              <Label htmlFor="observations" className="text-base font-semibold">
                Observações <span className="text-muted-foreground font-normal text-sm">(opcional)</span>
              </Label>
              <Textarea
                id="observations"
                placeholder="Ex: Cliente preferencial, necessita atenção especial..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} size="lg">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} size="lg" className="min-w-[160px]">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Encaixe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}