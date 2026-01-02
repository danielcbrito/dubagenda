import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  Award, 
  Eye, 
  Ban, 
  CheckCircle,
  Wallet,
  Calendar,
  ChevronLeft,
  X,
  Minus,
  Plus,
  Lock,
  RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Client {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  blocked: boolean;
  created_at: string;
  email: string | null;
  pontos: number;
  total_agendamentos: number;
  creditos: number;
}

interface Appointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco: number;
  servico: { nome: string } | null;
}

export function TIClientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  
  // Modal states
  const [showClientDetail, setShowClientDetail] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: string; data?: any } | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, cpf, telefone, blocked, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch emails via Edge Function
      let usersMap: Record<string, { email?: string }> = {};
      try {
        const response = await supabase.functions.invoke('manage-clients', {
          body: { action: 'list' }
        });
        if (response.data?.users) {
          usersMap = response.data.users;
        }
      } catch (e) {
        console.log('Could not fetch users from edge function:', e);
      }
      
      const { data: pontos } = await supabase.from("pontos").select("user_id, pontos");
      const { data: appointments } = await supabase.from("agendamentos").select("user_id");
      const { data: creditos } = await supabase.from("creditos").select("user_id, valor, usado");

      const clientsData = profiles?.map(profile => {
        const userData = usersMap[profile.id];
        const userPoints = pontos?.find(p => p.user_id === profile.id);
        const userAppointments = appointments?.filter(a => a.user_id === profile.id);
        const userCreditos = creditos?.filter(c => c.user_id === profile.id && !c.usado);
        const totalCreditos = userCreditos?.reduce((sum, c) => sum + c.valor, 0) || 0;

        return {
          ...profile,
          email: userData?.email || null,
          pontos: userPoints?.pontos || 0,
          total_agendamentos: userAppointments?.length || 0,
          creditos: totalCreditos,
        };
      }) || [];

      setClients(clientsData);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const openClientDetail = async (client: Client) => {
    setSelectedClient(client);
    setShowClientDetail(true);
    setLoadingAppointments(true);

    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          id, data, hora, status, preco,
          servicos:servico_id (nome)
        `)
        .eq("user_id", client.id)
        .order("data", { ascending: false })
        .limit(20);

      if (!error && data) {
        setClientAppointments(data.map(a => ({
          ...a,
          servico: a.servicos as { nome: string } | null
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const requestPasswordForAction = (type: string, data?: any) => {
    setPendingAction({ type, data });
    setAdminPassword("");
    setShowPasswordModal(true);
  };

  const verifyPasswordAndExecute = async () => {
    if (adminPassword !== "admin123") {
      toast.error("Senha incorreta");
      return;
    }

    setShowPasswordModal(false);
    
    if (pendingAction?.type === "block") {
      await executeBlockClient();
    } else if (pendingAction?.type === "wallet") {
      setShowWalletModal(true);
    } else if (pendingAction?.type === "cancelAppointment") {
      await executeCancelAppointment(pendingAction.data);
    }
    
    setPendingAction(null);
  };

  const executeBlockClient = async () => {
    if (!selectedClient) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ blocked: !selectedClient.blocked })
        .eq("id", selectedClient.id);

      if (error) throw error;
      
      toast.success(selectedClient.blocked ? "Cliente desbloqueado" : "Cliente bloqueado");
      setSelectedClient(prev => prev ? { ...prev, blocked: !prev.blocked } : null);
      loadClients();
    } catch (error) {
      toast.error("Erro ao atualizar cliente");
    } finally {
      setProcessing(false);
    }
  };

  const executeCancelAppointment = async (appointmentId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelled_by_admin" })
        .eq("id", appointmentId);

      if (error) throw error;
      
      toast.success("Agendamento cancelado");
      setClientAppointments(prev => 
        prev.map(a => a.id === appointmentId ? { ...a, status: "cancelled_by_admin" } : a)
      );
    } catch (error) {
      toast.error("Erro ao cancelar agendamento");
    } finally {
      setProcessing(false);
    }
  };

  const executeWalletAction = async (action: "add" | "remove") => {
    if (!selectedClient || !walletAmount) return;
    
    const amount = parseFloat(walletAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    if (action === "remove" && amount > selectedClient.creditos) {
      toast.error("Saldo insuficiente");
      return;
    }

    setProcessing(true);
    try {
      if (action === "add") {
        const { error } = await supabase.from("creditos").insert({
          user_id: selectedClient.id,
          valor: amount,
          origem: `Adicionado via TI: ${walletReason || "Ajuste manual"}`,
          usado: false
        });
        if (error) throw error;
      } else {
        // For removing, we mark existing credits as used
        const { data: existingCredits } = await supabase
          .from("creditos")
          .select("id, valor")
          .eq("user_id", selectedClient.id)
          .eq("usado", false)
          .order("created_at", { ascending: true });

        if (existingCredits) {
          let remaining = amount;
          for (const credit of existingCredits) {
            if (remaining <= 0) break;
            
            if (credit.valor <= remaining) {
              await supabase.from("creditos").update({ usado: true }).eq("id", credit.id);
              remaining -= credit.valor;
            } else {
              // Partial use - update the value
              await supabase.from("creditos")
                .update({ valor: credit.valor - remaining })
                .eq("id", credit.id);
              remaining = 0;
            }
          }
        }
      }

      toast.success(action === "add" ? "Crédito adicionado" : "Crédito removido");
      setShowWalletModal(false);
      setWalletAmount("");
      setWalletReason("");
      
      // Refresh client data
      const { data: creditos } = await supabase
        .from("creditos")
        .select("valor, usado")
        .eq("user_id", selectedClient.id)
        .eq("usado", false);
      
      const totalCreditos = creditos?.reduce((sum, c) => sum + c.valor, 0) || 0;
      setSelectedClient(prev => prev ? { ...prev, creditos: totalCreditos } : null);
      loadClients();
    } catch (error) {
      toast.error("Erro na operação");
    } finally {
      setProcessing(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.nome.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase()) ||
    client.cpf?.includes(search) ||
    client.telefone?.includes(search)
  );

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-400" },
      confirmed: { label: "Confirmado", color: "bg-blue-500/10 text-blue-400" },
      completed: { label: "Concluído", color: "bg-emerald-500/10 text-emerald-400" },
      cancelled_by_admin: { label: "Cancelado", color: "bg-red-500/10 text-red-400" },
      cancelled_by_user: { label: "Cancelado", color: "bg-red-500/10 text-red-400" },
      no_show: { label: "Não compareceu", color: "bg-orange-500/10 text-orange-400" },
    };
    const s = statusMap[status] || { label: status, color: "bg-gray-500/10 text-gray-400" };
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", s.color)}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] -mx-6 lg:-mx-8 -mt-6 lg:-mt-8 px-6 lg:px-8 py-3 border-b border-[#2a3142]">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <User className="w-5 h-5" />
            GESTÃO DE CLIENTES
          </h1>
          <p className="text-[11px] text-blue-200/70 mt-0.5">
            {filteredClients.length} clientes cadastrados
          </p>
        </div>
        <Button 
          onClick={loadClients} 
          disabled={loading}
          size="sm"
          className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Buscar por nome, e-mail, CPF ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-9 bg-[#0d1117] border-[#2a3142] text-sm"
        />
      </div>

      {/* Clients Table */}
      <div className="bg-[#0d1117] border border-[#2a3142] rounded-lg overflow-hidden">
        <div className="bg-[#161b22] px-4 py-2 border-b border-[#2a3142]">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Lista de Clientes
          </span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-500">Carregando...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#161b22] border-b border-[#2a3142]">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Cliente</th>
                  <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell">Contato</th>
                  <th className="text-center px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Pontos</th>
                  <th className="text-center px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Créditos</th>
                  <th className="text-center px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Status</th>
                  <th className="text-right px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3142]">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-[#161b22] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-400">
                            {client.nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-300">{client.nome}</p>
                          <p className="text-[10px] text-gray-500 md:hidden">
                            {client.email || client.telefone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {client.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[180px]">{client.email}</span>
                          </div>
                        )}
                        {client.telefone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                            <Phone className="w-3 h-3" />
                            <span>{client.telefone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-amber-400">{client.pontos}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium text-emerald-400">
                        R$ {client.creditos.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium",
                        client.blocked 
                          ? "bg-red-500/10 text-red-400" 
                          : "bg-emerald-500/10 text-emerald-400"
                      )}>
                        {client.blocked ? "Bloqueado" : "Ativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-gray-400 hover:text-white"
                        onClick={() => openClientDetail(client)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Client Detail Modal */}
      <Dialog open={showClientDetail} onOpenChange={setShowClientDetail}>
        <DialogContent className="max-w-2xl bg-[#0d1117] border-[#2a3142]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-400">
                  {selectedClient?.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold">{selectedClient?.nome}</p>
                <p className="text-xs text-gray-500 font-normal">{selectedClient?.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-4">
              {/* Info Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase">Pontos</p>
                  <p className="text-lg font-bold text-amber-400">{selectedClient.pontos}</p>
                </div>
                <div className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase">Créditos</p>
                  <p className="text-lg font-bold text-emerald-400">R$ {selectedClient.creditos.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase">Agendamentos</p>
                  <p className="text-lg font-bold text-blue-400">{selectedClient.total_agendamentos}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "flex-1 h-9 text-xs border-[#2a3142]",
                    selectedClient.blocked 
                      ? "text-emerald-400 hover:bg-emerald-500/10" 
                      : "text-red-400 hover:bg-red-500/10"
                  )}
                  onClick={() => requestPasswordForAction("block")}
                  disabled={processing}
                >
                  {selectedClient.blocked ? (
                    <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Desbloquear</>
                  ) : (
                    <><Ban className="w-3.5 h-3.5 mr-1.5" /> Bloquear</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9 text-xs border-[#2a3142] text-blue-400 hover:bg-blue-500/10"
                  onClick={() => requestPasswordForAction("wallet")}
                  disabled={processing}
                >
                  <Wallet className="w-3.5 h-3.5 mr-1.5" />
                  Gerenciar Carteira
                </Button>
              </div>

              {/* Appointments */}
              <div className="border border-[#2a3142] rounded-lg overflow-hidden">
                <div className="bg-[#161b22] px-3 py-2 border-b border-[#2a3142]">
                  <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                    Histórico de Agendamentos
                  </span>
                </div>
                
                {loadingAppointments ? (
                  <div className="p-4 text-center">
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto" />
                  </div>
                ) : clientAppointments.length === 0 ? (
                  <div className="p-4 text-center">
                    <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Nenhum agendamento</p>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {clientAppointments.map((apt) => (
                      <div 
                        key={apt.id}
                        className="flex items-center justify-between px-3 py-2 border-b border-[#2a3142] last:border-0 hover:bg-[#161b22]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-xs font-bold text-gray-300">
                              {new Date(apt.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </p>
                            <p className="text-[10px] text-gray-500">{apt.hora}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-300">{apt.servico?.nome || "Serviço"}</p>
                            <p className="text-[10px] text-gray-500">R$ {apt.preco.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(apt.status)}
                          {!["cancelled_by_admin", "cancelled_by_user", "completed", "no_show"].includes(apt.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] text-red-400 hover:bg-red-500/10"
                              onClick={() => requestPasswordForAction("cancelAppointment", apt.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-sm bg-[#0d1117] border-[#2a3142]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Autenticação Necessária
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Digite a senha de administrador para continuar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Senha</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#161b22] border-[#2a3142]"
                onKeyDown={(e) => e.key === "Enter" && verifyPasswordAndExecute()}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswordModal(false)}
              className="border-[#2a3142] text-gray-400"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={verifyPasswordAndExecute}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet Modal */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="max-w-sm bg-[#0d1117] border-[#2a3142]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Gerenciar Carteira
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Saldo atual: R$ {selectedClient?.creditos.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Valor</Label>
              <Input
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                placeholder="0.00"
                className="bg-[#161b22] border-[#2a3142]"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Motivo (opcional)</Label>
              <Textarea
                value={walletReason}
                onChange={(e) => setWalletReason(e.target.value)}
                placeholder="Descreva o motivo da operação..."
                className="bg-[#161b22] border-[#2a3142] h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => executeWalletAction("remove")}
              disabled={processing || !walletAmount}
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Minus className="w-3.5 h-3.5 mr-1" />
              Remover
            </Button>
            <Button
              size="sm"
              onClick={() => executeWalletAction("add")}
              disabled={processing || !walletAmount}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
