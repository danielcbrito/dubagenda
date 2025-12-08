import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, User, Mail, Phone, Award, MoreVertical, Ban, CheckCircle, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  nome: string;
  cpf: string | null;
  blocked: boolean;
  created_at: string;
  email: string | null;
  pontos: number;
  total_agendamentos: number;
}

export function AdminClientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();

    const channel = supabase
      .channel('admin-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadClients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadClients = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, cpf, blocked, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: usersData } = await supabase.auth.admin.listUsers();
      const users = usersData?.users || [];
      
      const { data: pontos } = await supabase
        .from("pontos")
        .select("user_id, pontos");

      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("user_id");

      const clientsData = profiles?.map(profile => {
        const user = users?.find(u => u.id === profile.id);
        const userPoints = pontos?.find(p => p.user_id === profile.id);
        const userAppointments = appointments?.filter(a => a.user_id === profile.id);

        return {
          ...profile,
          email: user?.email || null,
          pontos: userPoints?.pontos || 0,
          total_agendamentos: userAppointments?.length || 0,
        };
      }) || [];

      setClients(clientsData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Erro ao carregar clientes");
      setLoading(false);
    }
  };

  const handleBlockClient = async (id: string, currentBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ blocked: !currentBlocked })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentBlocked ? "Cliente desbloqueado" : "Cliente bloqueado");
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Erro ao atualizar cliente");
    }
  };

  const filteredClients = clients.filter(client =>
    client.nome.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase()) ||
    client.cpf?.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie seus clientes • {filteredClients.length} registros
          </p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, e-mail ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glass pl-11 h-11"
          />
        </div>
      </div>

      {loading ? (
        <Card className="glass-card p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-muted-foreground text-sm">Carregando clientes...</p>
          </div>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card className="glass-card p-12">
          <div className="text-center">
            <User className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" strokeWidth={1} />
            <p className="text-muted-foreground">Nenhum cliente encontrado</p>
          </div>
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="hidden md:table-cell">Contato</th>
                  <th>Pontos</th>
                  <th className="hidden lg:table-cell">Agendamentos</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client, index) => (
                  <tr 
                    key={client.id} 
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar-glow w-10 h-10 bg-primary/15 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {client.nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{client.nome}</p>
                          <p className="text-xs text-muted-foreground truncate md:hidden">
                            {client.email || client.cpf}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="space-y-1">
                        {client.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-foreground truncate max-w-[180px]">{client.email}</span>
                          </div>
                        )}
                        {client.cpf && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">{client.cpf}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="font-bold price-gold">{client.pontos}</span>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell">
                      <span className="text-foreground font-medium">{client.total_agendamentos}</span>
                    </td>
                    <td>
                      <span className={cn("status-tag", client.blocked ? "blocked" : "active")}>
                        {client.blocked ? "Bloqueado" : "Ativo"}
                      </span>
                    </td>
                    <td className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 hover:bg-secondary"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem className="gap-2">
                            <Eye className="w-4 h-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className={cn(
                              "gap-2",
                              client.blocked ? "text-green-500" : "text-destructive"
                            )}
                            onClick={() => handleBlockClient(client.id, client.blocked)}
                          >
                            {client.blocked ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Desbloquear
                              </>
                            ) : (
                              <>
                                <Ban className="w-4 h-4" />
                                Bloquear
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
