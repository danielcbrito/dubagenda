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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-premium"
          />
        </div>
      </div>

      {loading ? (
        <Card className="p-6 card-premium">
          <p className="text-muted-foreground">Carregando clientes...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="p-6 card-premium hover:scale-105 transition-transform">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{client.nome}</h3>
                      {client.blocked && (
                        <span className="text-xs text-red-400">Bloqueado</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {client.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.cpf && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{client.cpf}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Award className="w-4 h-4" />
                    <span>{client.pontos} pontos • {client.total_agendamentos} agendamentos</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={client.blocked ? "default" : "destructive"}
                    onClick={() => handleBlockClient(client.id, client.blocked)}
                    className="flex-1"
                  >
                    {client.blocked ? "Desbloquear" : "Bloquear"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
