import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, User, Mail, Phone, Award } from "lucide-react";

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
      // Get profiles with user emails
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, cpf, blocked, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get user emails from auth.users
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const users = usersData?.users || [];
      
      // Get points for each user
      const { data: pontos } = await supabase
        .from("pontos")
        .select("user_id, pontos");

      // Get appointment counts
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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes e visualize suas informações</p>
        </div>
        <div className="flex items-center gap-2 max-w-md w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por nome, e-mail ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-premium pl-10"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 card-premium">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando clientes...</p>
          </div>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card className="p-12 card-premium">
          <div className="text-center">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">Nenhum cliente encontrado</p>
          </div>
        </Card>
      ) : (
        <Card className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground hidden md:table-cell">
                    Contato
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Pontos
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground hidden lg:table-cell">
                    Agendamentos
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{client.nome}</p>
                          <p className="text-sm text-muted-foreground truncate md:hidden">
                            {client.email || client.cpf}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="space-y-1">
                        {client.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-foreground truncate">{client.email}</span>
                          </div>
                        )}
                        {client.cpf && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">{client.cpf}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="font-semibold text-gold">{client.pontos}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-foreground font-medium">{client.total_agendamentos}</span>
                    </td>
                    <td className="px-6 py-4">
                      {client.blocked ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant={client.blocked ? "default" : "destructive"}
                        onClick={() => handleBlockClient(client.id, client.blocked)}
                        className="transition-all"
                      >
                        {client.blocked ? "Desbloquear" : "Bloquear"}
                      </Button>
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
