import { useState, useEffect, memo, useRef } from "react";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Search, 
  User, 
  Clock, 
  DollarSign, 
  Calendar, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  AlertCircle,
  Scissors
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileManualBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  initialTime: string;
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
}

interface TimeSlot {
  time: string;
  available: boolean;
}

export function MobileManualBookingModal({ 
  open, 
  onOpenChange, 
  date, 
  initialTime, 
  onSuccess 
}: MobileManualBookingModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Form state
  const [selectedTime, setSelectedTime] = useState(initialTime);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [manualClientName, setManualClientName] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [observations, setObservations] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [validationError, setValidationError] = useState("");
  
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      loadInitialData();
      setSelectedTime(initialTime);
      resetForm();
    }
  }, [open, initialTime]);

  useEffect(() => {
    if (open && selectedService) {
      loadAvailableSlots();
    }
  }, [selectedService, date]);

  const resetForm = () => {
    setStep(1);
    setSelectedClient(null);
    setManualClientName("");
    setSelectedService(null);
    setObservations("");
    setSearchQuery("");
    setValidationError("");
  };

  const loadInitialData = async () => {
    try {
      const [servicesRes, clientsRes] = await Promise.all([
        supabase.from("servicos").select("id, nome, duracao_minutos, preco").eq("ativo", true).order("nome"),
        supabase.from("profiles").select("id, nome, telefone").order("nome")
      ]);

      setServices(servicesRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedService) return;
    
    setLoadingSlots(true);
    try {
      const dayOfWeek = new Date(date + "T12:00:00").getDay();
      
      // Carregar configuração de horário
      const [horarioRes, exceptionalRes, appointmentsRes] = await Promise.all([
        supabase.from("configuracoes_horario").select("*").eq("dia_semana", dayOfWeek).maybeSingle(),
        supabase.from("horarios_excepcionais").select("*").eq("data", date).maybeSingle(),
        supabase.from("agendamentos").select("hora, duracao").eq("data", date).in("status", ["pending", "confirmed", "completed"])
      ]);

      const config = exceptionalRes.data || horarioRes.data || {
        hora_abertura: "08:00",
        hora_fechamento: "20:00",
        hora_almoco_inicio: null,
        hora_almoco_fim: null
      };

      const existingAppointments = appointmentsRes.data || [];
      
      // Gerar slots
      const slots: TimeSlot[] = [];
      const [startH, startM] = config.hora_abertura.split(":").map(Number);
      const [endH, endM] = config.hora_fechamento.split(":").map(Number);
      
      let current = new Date();
      current.setHours(startH, startM, 0, 0);
      
      const end = new Date();
      end.setHours(endH, endM, 0, 0);

      // Subtrair duração do serviço do horário final
      const lastPossibleStart = addMinutes(end, -selectedService.duracao_minutos);

      while (current <= lastPossibleStart) {
        const timeStr = format(current, "HH:mm");
        
        // Verificar se está no almoço
        let isLunch = false;
        if (config.hora_almoco_inicio && config.hora_almoco_fim) {
          const [lsH, lsM] = config.hora_almoco_inicio.split(":").map(Number);
          const [leH, leM] = config.hora_almoco_fim.split(":").map(Number);
          const currentMinutes = current.getHours() * 60 + current.getMinutes();
          const lunchStart = lsH * 60 + lsM;
          const lunchEnd = leH * 60 + leM;
          isLunch = currentMinutes >= lunchStart && currentMinutes < lunchEnd;
        }

        // Verificar conflitos com agendamentos existentes
        const serviceEnd = addMinutes(current, selectedService.duracao_minutos);
        let hasConflict = false;
        
        for (const apt of existingAppointments) {
          const [aptH, aptM] = apt.hora.split(":").map(Number);
          const aptStart = new Date();
          aptStart.setHours(aptH, aptM, 0, 0);
          const aptEnd = addMinutes(aptStart, apt.duracao || 30);
          
          // Verificar sobreposição
          if (current < aptEnd && serviceEnd > aptStart) {
            hasConflict = true;
            break;
          }
        }

        slots.push({
          time: timeStr,
          available: !isLunch && !hasConflict
        });

        current = addMinutes(current, 30);
      }

      setAvailableSlots(slots);
    } catch (error) {
      console.error("Error loading slots:", error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setLoading(true);
    setValidationError("");

    try {
      // Validar horário via edge function
      const { data: validation, error: validationError } = await supabase.functions.invoke('validate-appointment', {
        body: {
          data: date,
          hora: selectedTime,
          duracao: selectedService?.duracao_minutos || 30,
          userId: 'manual-booking'
        }
      });

      if (validationError || !validation?.valid) {
        setValidationError(validation?.message || "Horário indisponível. Selecione outro.");
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      let clientId = selectedClient?.id;
      let appointmentObservations = observations.trim();

      // Cliente walk-in
      if (!selectedClient && manualClientName.trim()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          throw new Error("Você precisa estar logado");
        }
        
        clientId = session.user.id;
        const walkInNote = `🚶 Cliente walk-in: ${manualClientName.trim()}`;
        appointmentObservations = appointmentObservations 
          ? `${walkInNote}\n${appointmentObservations}`
          : walkInNote;
      }

      if (!clientId || !selectedService) throw new Error("Dados incompletos");

      // Criar agendamento
      const { error: appointmentError } = await supabase
        .from("agendamentos")
        .insert({
          user_id: clientId,
          servico_id: selectedService.id,
          data: date,
          hora: selectedTime + ":00",
          duracao: selectedService.duracao_minutos,
          preco: selectedService.preco,
          status: "confirmed",
          barbeiro_confirmou: true,
          cliente_confirmou: true,
          observacoes: appointmentObservations || null,
          tipo_agendamento: "encaixe_manual",
          criado_por: "barbeiro",
          payment_method: "cash"
        });

      if (appointmentError) throw appointmentError;

      toast.success("✅ Encaixe criado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao criar encaixe:", error);
      setValidationError(error.message || "Erro ao criar encaixe");
      toast.error("Erro ao criar encaixe");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const filteredClients = searchQuery.trim() 
    ? clients.filter(c => 
        c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.telefone?.includes(searchQuery)
      )
    : [];

  const canProceedStep1 = selectedService !== null;
  const canProceedStep2 = selectedTime !== "";
  const canProceedStep3 = selectedClient || manualClientName.trim();

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-4 safe-area-inset-top">
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
              className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-95 transition-transform"
            >
              {step > 1 ? <ChevronLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
            
            <div className="text-center">
              <h2 className="font-bold text-lg">Encaixar Cliente</h2>
              <p className="text-xs text-muted-foreground">
                {format(new Date(date + "T12:00:00"), "d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            
            <div className="w-10" />
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  step >= s 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary/50 text-muted-foreground"
                )}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 4 && (
                  <div className={cn(
                    "w-8 h-0.5 mx-1 rounded-full transition-all",
                    step > s ? "bg-primary" : "bg-secondary/50"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {/* Step 1: Serviço */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 space-y-4"
            >
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Qual serviço?</h3>
                <p className="text-sm text-muted-foreground">Selecione o tipo de atendimento</p>
              </div>

              <div className="space-y-2">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98]",
                      selectedService?.id === service.id
                        ? "bg-primary/10 border-primary"
                        : "bg-secondary/30 border-border/30 hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          selectedService?.id === service.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary"
                        )}>
                          <Scissors className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{service.nome}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {service.duracao_minutos}min
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">R$ {service.preco.toFixed(0)}</p>
                        {selectedService?.id === service.id && (
                          <Check className="w-5 h-5 text-primary ml-auto mt-1" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Horário */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 space-y-4"
            >
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Qual horário?</h3>
                <p className="text-sm text-muted-foreground">
                  Serviço de {selectedService?.duracao_minutos}min
                </p>
              </div>

              {loadingSlots ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.map(({ time, available }) => (
                    <button
                      key={time}
                      onClick={() => available && setSelectedTime(time)}
                      disabled={!available}
                      className={cn(
                        "py-3 rounded-xl text-sm font-medium transition-all",
                        selectedTime === time
                          ? "bg-primary text-primary-foreground shadow-glow-red"
                          : available
                            ? "bg-secondary/30 hover:bg-secondary/50 active:scale-95"
                            : "bg-secondary/10 text-muted-foreground/30 cursor-not-allowed line-through"
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}

              {selectedTime && selectedService && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Início:</span>
                    <span className="font-bold">{selectedTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Término:</span>
                    <span className="font-bold">
                      {(() => {
                        const [h, m] = selectedTime.split(":").map(Number);
                        const end = new Date();
                        end.setHours(h, m, 0, 0);
                        return format(addMinutes(end, selectedService.duracao_minutos), "HH:mm");
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Cliente */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 space-y-4"
            >
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Qual cliente?</h3>
                <p className="text-sm text-muted-foreground">Busque ou digite o nome</p>
              </div>

              {selectedClient ? (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedClient.nome}</p>
                        {selectedClient.telefone && (
                          <p className="text-xs text-muted-foreground">{selectedClient.telefone}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedClient(null)}
                      className="px-3 py-1.5 rounded-lg bg-secondary/50 text-sm font-medium"
                    >
                      Trocar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>

                  {filteredClients.length > 0 && (
                    <ScrollArea className="h-40 rounded-xl border border-border/30">
                      <div className="p-2 space-y-1">
                        {filteredClients.slice(0, 10).map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClient(client);
                              setSearchQuery("");
                              setManualClientName("");
                            }}
                            className="w-full p-3 rounded-lg hover:bg-secondary/50 text-left flex items-center gap-3"
                          >
                            <User className="w-4 h-4 text-muted-foreground" />
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
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/30" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-3 text-xs text-muted-foreground">
                        ou digite o nome
                      </span>
                    </div>
                  </div>

                  <Input
                    placeholder="Nome do cliente (walk-in)"
                    value={manualClientName}
                    onChange={(e) => {
                      setManualClientName(e.target.value);
                      setSearchQuery("");
                    }}
                    className="h-12 text-base"
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* Step 4: Confirmação */}
          {step === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 space-y-4"
            >
              <div className="text-center pb-2">
                <h3 className="font-semibold text-lg">Confirmar encaixe</h3>
                <p className="text-sm text-muted-foreground">Revise os dados</p>
              </div>

              {/* Resumo */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="font-medium">Data e Horário</span>
                  </div>
                  <p className="text-lg font-bold">
                    {format(new Date(date + "T12:00:00"), "d 'de' MMMM", { locale: ptBR })} às {selectedTime}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Scissors className="w-5 h-5 text-primary" />
                    <span className="font-medium">Serviço</span>
                  </div>
                  <p className="text-lg font-bold">{selectedService?.nome}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{selectedService?.duracao_minutos}min</span>
                    <span>R$ {selectedService?.preco.toFixed(2)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-3 mb-3">
                    <User className="w-5 h-5 text-primary" />
                    <span className="font-medium">Cliente</span>
                  </div>
                  <p className="text-lg font-bold">
                    {selectedClient?.nome || manualClientName}
                  </p>
                </div>

                <Textarea
                  placeholder="Observações (opcional)"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="min-h-[80px]"
                />

                {validationError && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">{validationError}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/30 safe-area-inset-bottom">
          {step === 1 && (
            <Button 
              onClick={() => setStep(2)} 
              disabled={!canProceedStep1}
              className="w-full h-14 text-base font-bold"
            >
              Próximo: Escolher Horário
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
          
          {step === 2 && (
            <Button 
              onClick={() => setStep(3)} 
              disabled={!canProceedStep2}
              className="w-full h-14 text-base font-bold"
            >
              Próximo: Escolher Cliente
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
          
          {step === 3 && (
            <Button 
              onClick={() => setStep(4)} 
              disabled={!canProceedStep3}
              className="w-full h-14 text-base font-bold"
            >
              Próximo: Confirmar
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
          
          {step === 4 && (
            <Button 
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-14 text-base font-bold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirmar Encaixe
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
