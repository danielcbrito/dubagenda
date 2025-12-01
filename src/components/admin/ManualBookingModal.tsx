import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertCircle, Search, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📌 Criar Encaixe Manual</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Data: {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")} às {time}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">{selectedClient.nome}</p>
                    {selectedClient.telefone && (
                      <p className="text-sm text-muted-foreground">{selectedClient.telefone}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClient(null)}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente cadastrado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {filteredClients.length > 0 && (
                  <ScrollArea className="h-[150px] border rounded-lg p-2">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClient(client);
                          setSearchQuery("");
                          setManualClientName("");
                        }}
                        className="w-full text-left p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <p className="font-medium">{client.nome}</p>
                        {client.telefone && (
                          <p className="text-sm text-muted-foreground">{client.telefone}</p>
                        )}
                      </button>
                    ))}
                  </ScrollArea>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <Input
                  placeholder="Digite o nome do cliente manualmente"
                  value={manualClientName}
                  onChange={(e) => {
                    setManualClientName(e.target.value);
                    setSearchQuery("");
                  }}
                />
              </div>
            )}
          </div>

          {/* Serviço */}
          <div className="space-y-2">
            <Label htmlFor="service">Serviço</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger id="service">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.nome} - {service.duracao_minutos} min - R$ {service.preco.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duração e preço */}
          {selectedServiceData && (
            <div className="flex gap-4">
              <Badge variant="secondary" className="py-2 px-4">
                ⏱️ Duração: {selectedServiceData.duracao_minutos} minutos
              </Badge>
              <Badge variant="secondary" className="py-2 px-4">
                💰 Preço: R$ {selectedServiceData.preco.toFixed(2)}
              </Badge>
              <Badge variant="secondary" className="py-2 px-4">
                🕐 Término: {(() => {
                  const [h, m] = time.split(":").map(Number);
                  const endMinutes = h * 60 + m + selectedServiceData.duracao_minutos;
                  const endH = Math.floor(endMinutes / 60);
                  const endM = endMinutes % 60;
                  return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
                })()}
              </Badge>
            </div>
          )}

          {/* Erro de validação */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observações (opcional)</Label>
            <Textarea
              id="observations"
              placeholder="Ex: Cliente preferencial, necessita atenção especial..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Encaixe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}