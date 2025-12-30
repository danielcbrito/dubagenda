import { useState, useEffect, memo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertCircle, Search, User, Clock, DollarSign, Calendar, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "./ErrorBoundary";
import { cn } from "@/lib/utils";

interface ManualBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  onSuccess: () => void;
  barbeiroId?: string; // Barbeiro pré-selecionado (opcional)
}

interface Barbeiro {
  id: string;
  apelido: string;
  foto_url: string | null;
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

// Helper: Promise com timeout
const promiseWithTimeout = <T,>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: operação demorou mais que ' + ms + 'ms')), ms)
    )
  ]);
};

export function ManualBookingModal({ open, onOpenChange, date, time, onSuccess, barbeiroId: initialBarbeiroId }: ManualBookingModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [manualClientName, setManualClientName] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarbeiroId, setSelectedBarbeiroId] = useState<string | null>(initialBarbeiroId || null);
  const [observations, setObservations] = useState("");
  const [validationError, setValidationError] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<"idle" | "success" | "error">("idle");
  
  // Prevent multiple submits
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      loadServices();
      loadClients();
      loadBarbeiros();
      resetForm();
      // Se barbeiro foi passado como prop, manter selecionado
      if (initialBarbeiroId) {
        setSelectedBarbeiroId(initialBarbeiroId);
      }
    }
  }, [open, initialBarbeiroId]);

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
    setStep(1);
    setSelectedClient(null);
    setManualClientName("");
    setSelectedService("");
    setSelectedBarbeiroId(initialBarbeiroId || null);
    setObservations("");
    setValidationError("");
    setSearchQuery("");
    setFilteredClients([]);
    setConfirmStatus("idle");
  };

  const loadBarbeiros = async () => {
    try {
      const { data, error } = await supabase
        .from("barbeiros")
        .select("id, apelido, foto_url")
        .eq("ativo", true)
        .order("apelido");

      if (error) throw error;
      setBarbeiros(data || []);
    } catch (error) {
      console.error("Error loading barbers:", error);
    }
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
    
    if (!selectedBarbeiroId) {
      setValidationError("Selecione um barbeiro.");
      return false;
    }

    try {
      // Usar edge function para validação atômica - AGORA COM BARBEIRO
      console.log('[ManualBooking] Validando horário via edge function para barbeiro:', selectedBarbeiroId);
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: date,
          hora: time,
          duracao: selectedServiceData.duracao_minutos,
          userId: 'manual-booking',
          barbeiroId: selectedBarbeiroId // Validar na agenda do barbeiro específico
        }
      });

      if (validationError) {
        console.error('[ManualBooking] Erro na validação:', validationError);
        setValidationError("Erro ao verificar disponibilidade. Tente novamente.");
        return false;
      }

      if (!validation?.valid) {
        console.log('[ManualBooking] Horário INDISPONÍVEL:', validation?.message);
        setValidationError(validation?.message || "Horário indisponível.");
        return false;
      }

      console.log('[ManualBooking] Horário DISPONÍVEL');
      setValidationError("");
      return true;
    } catch (error) {
      console.error('[ManualBooking] Erro na validação:', error);
      setValidationError("Erro ao verificar disponibilidade.");
      return false;
    }
  };

  const handleSubmit = async () => {
    console.log('[Encaixe] Iniciando confirmação', { date, time, selectedService, selectedClient, manualClientName });
    
    // Prevent double-submit
    if (isSubmittingRef.current) {
      console.warn('[Encaixe] Submit já em andamento, ignorando');
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);
    setValidationError("");

    try {
      // Validar horário com timeout
      console.log('[Encaixe] Validando horário...');
      const isValid = await promiseWithTimeout(validateTimeSlot(), 8000);
      if (!isValid) {
        console.warn('[Encaixe] Validação falhou');
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }
      console.log('[Encaixe] Horário validado com sucesso');

      const selectedServiceData = services.find((s) => s.id === selectedService);
      if (!selectedServiceData) throw new Error("Serviço não encontrado");

      let clientId = selectedClient?.id;
      let appointmentObservations = observations.trim();

      // Se cliente digitado manualmente (walk-in), usar o barbeiro logado como referência
      // e guardar o nome do cliente nas observações
      if (!selectedClient && manualClientName.trim()) {
        console.log('[Encaixe] Cliente walk-in (manual):', manualClientName.trim());
        
        // Buscar o usuário atual (barbeiro logado) para usar como referência do agendamento
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          throw new Error("Você precisa estar logado para criar encaixes");
        }
        
        clientId = session.user.id;
        
        // Adicionar nome do cliente walk-in nas observações
        const walkInNote = `🚶 Cliente walk-in: ${manualClientName.trim()}`;
        appointmentObservations = appointmentObservations 
          ? `${walkInNote}\n${appointmentObservations}`
          : walkInNote;
          
        console.log('[Encaixe] Usando ID do barbeiro como referência, nome do cliente nas observações');
      }

      if (!clientId) throw new Error("Cliente não definido");

      // Criar agendamento com timeout - AGORA COM BARBEIRO_ID
      console.log('[Encaixe] Criando agendamento para barbeiro:', selectedBarbeiroId);
      const insertPromise = Promise.resolve(
        supabase
          .from("agendamentos")
          .insert({
            user_id: clientId,
            servico_id: selectedService,
            barbeiro_id: selectedBarbeiroId, // Associar ao barbeiro selecionado
            data: date,
            hora: time + ":00",
            duracao: selectedServiceData.duracao_minutos,
            preco: selectedServiceData.preco,
            status: "confirmed",
            barbeiro_confirmou: true,
            cliente_confirmou: true,
            observacoes: appointmentObservations || null,
            tipo_agendamento: "encaixe_manual",
            criado_por: "barbeiro",
            payment_method: "cash"
          })
      );
        
      const { error: appointmentError } = await promiseWithTimeout(insertPromise, 10000);

      if (appointmentError) throw appointmentError;
      console.log('[Encaixe] Agendamento criado com sucesso');

      setConfirmStatus("success");
      toast.success("✅ Encaixe criado com sucesso!");
      console.log('[Encaixe] Processo concluído com sucesso');
      
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1200);
    } catch (error: any) {
      console.error('[Encaixe] Erro ao criar encaixe:', error);
      setConfirmStatus("error");
      
      let errorMessage = 'Erro ao criar encaixe. Tente novamente.';
      
      if (error.message?.includes('Timeout')) {
        errorMessage = 'Operação demorou muito. Verifique sua conexão e tente novamente.';
      } else if (error.message?.includes('foreign key') || error.message?.includes('profiles_id_fkey')) {
        errorMessage = 'Erro de referência de cliente. Por favor, selecione um cliente da lista.';
      } else if (error.message) {
        errorMessage = error.message;
      }
        
      setValidationError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
      console.log('[Encaixe] Finalizando submit');
    }
  };

  const selectedServiceData = services.find((s) => s.id === selectedService);
  const selectedBarbeiroData = barbeiros.find((b) => b.id === selectedBarbeiroId);

  const canProceedStep1 = selectedClient || manualClientName.trim();
  const canProceedStep2 = selectedService;
  const canProceedStep3 = selectedBarbeiroId;

  return (
    <ErrorBoundary>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[480px] max-h-[85vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <span>Criar Encaixe Manual</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { 
              weekday: 'short', 
              day: '2-digit', 
              month: 'short'
            })}
            <span className="text-muted-foreground/50">•</span>
            <Clock className="h-4 w-4" />
            {time}
          </DialogDescription>
        </DialogHeader>

        {/* Premium Stepper - Agora com 4 steps incluindo Barbeiro */}
        <div className="flex items-center justify-center gap-1 py-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all duration-300",
                step >= s 
                  ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,59,59,0.4)]' 
                  : 'bg-white/[0.05] text-muted-foreground border border-white/[0.08]'
              )}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div className={cn(
                  "w-8 h-0.5 mx-1 transition-all duration-300 rounded-full",
                  step > s ? 'bg-primary' : 'bg-white/[0.08]'
                )} />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 -mr-2">
          {/* Step 1: Cliente */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Selecione o Cliente</h3>
                <p className="text-sm text-muted-foreground">Busque ou digite o nome</p>
              </div>
              {selectedClient ? (
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{selectedClient.nome}</p>
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
                      placeholder="Buscar cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {filteredClients.length > 0 && (
                    <Card className="max-h-40 overflow-auto">
                      <div className="p-2 space-y-1">
                        {filteredClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClient(client);
                              setSearchQuery("");
                              setManualClientName("");
                            }}
                            className="w-full text-left p-2 hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{client.nome}</p>
                              {client.telefone && (
                                <p className="text-xs text-muted-foreground">{client.telefone}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-2 text-muted-foreground">ou digite</span>
                    </div>
                  </div>

                  <Input
                    placeholder="Nome do cliente"
                    value={manualClientName}
                    onChange={(e) => {
                      setManualClientName(e.target.value);
                      setSearchQuery("");
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Serviço */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Selecione o Serviço</h3>
                <p className="text-sm text-muted-foreground">Escolha o tipo de atendimento</p>
              </div>

              <div className="grid gap-2 max-h-80 overflow-y-auto pr-2">
                {services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    selected={selectedService === service.id}
                    onClick={() => setSelectedService(service.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Barbeiro */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Selecione o Barbeiro</h3>
                <p className="text-sm text-muted-foreground">Quem vai atender?</p>
              </div>

              <div className="grid gap-2 max-h-80 overflow-y-auto pr-2">
                {barbeiros.map((barbeiro) => (
                  <Card
                    key={barbeiro.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedBarbeiroId === barbeiro.id ? 'border-2 border-primary bg-primary/5' : 'border hover:border-primary/30'
                    }`}
                    onClick={() => setSelectedBarbeiroId(barbeiro.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {barbeiro.foto_url ? (
                              <img src={barbeiro.foto_url} alt={barbeiro.apelido} className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <p className="font-semibold">{barbeiro.apelido}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selectedBarbeiroId === barbeiro.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {selectedBarbeiroId === barbeiro.id && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Resumo */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Confirme os Dados</h3>
                <p className="text-sm text-muted-foreground">Revise antes de confirmar</p>
              </div>

              {/* Barbeiro Info */}
              {selectedBarbeiroData && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-4 w-4" />
                      Barbeiro
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {selectedBarbeiroData.foto_url ? (
                          <img src={selectedBarbeiroData.foto_url} alt={selectedBarbeiroData.apelido} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="font-semibold">{selectedBarbeiroData.apelido}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cliente Info */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    Cliente
                  </div>
                  <p className="font-semibold">{selectedClient?.nome || manualClientName}</p>
                </CardContent>
              </Card>

              {/* Serviço Info */}
              {selectedServiceData && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Serviço
                    </div>
                    <div>
                      <p className="font-semibold mb-2">{selectedServiceData.nome}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted rounded-md">
                          <p className="text-xs text-muted-foreground">Duração</p>
                          <p className="font-bold text-sm">{selectedServiceData.duracao_minutos}min</p>
                        </div>
                        <div className="p-2 bg-muted rounded-md">
                          <p className="text-xs text-muted-foreground">Preço</p>
                          <p className="font-bold text-sm">R$ {selectedServiceData.preco.toFixed(2)}</p>
                        </div>
                        <div className="p-2 bg-muted rounded-md">
                          <p className="text-xs text-muted-foreground">Término</p>
                          <p className="font-bold text-sm">
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
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="observations" className="text-sm">
                  Observações <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Textarea
                  id="observations"
                  placeholder="Ex: Cliente preferencial..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {confirmStatus === "success" && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600">
                    Encaixe criado com sucesso!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 3 && (
            <Button onClick={() => setStep(4)} disabled={!canProceedStep3}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 4 && (
            <Button onClick={handleSubmit} disabled={loading || confirmStatus === "success"} className="min-w-32">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmStatus === "success" ? "Confirmado!" : "Confirmar"}
            </Button>
          )}
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}

// Memoized service card component to prevent unnecessary re-renders
const ServiceCard = memo(({ service, selected, onClick }: {
  service: Service;
  selected: boolean;
  onClick: () => void;
}) => (
  <Card
    className={`cursor-pointer transition-all hover:shadow-md ${
      selected ? 'border-2 border-primary bg-primary/5' : 'border hover:border-primary/30'
    }`}
    onClick={onClick}
  >
    <CardContent className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-semibold mb-1">{service.nome}</h4>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {service.duracao_minutos}min
            </Badge>
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              R$ {service.preco.toFixed(2)}
            </Badge>
          </div>
        </div>
        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
        }`}>
          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
      </div>
    </CardContent>
  </Card>
));