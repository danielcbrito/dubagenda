import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, Gift, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";

interface Appointment {
  id: string;
  data: string;
  hora: string;
  servico: { nome: string };
  status: string;
}

const Cliente = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [points, setPoints] = useState(0);
  const [redemptions, setRedemptions] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    loadUserData(session.user.id);
  };

  const loadUserData = async (userId: string) => {
    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    setProfile(profileData);

    // Load appointments
    const { data: appointmentsData } = await supabase
      .from("agendamentos")
      .select(`
        id,
        data,
        hora,
        status,
        servico:servicos(nome)
      `)
      .eq("user_id", userId)
      .order("data", { ascending: false })
      .limit(5);

    setAppointments(appointmentsData || []);

    // Load points
    const { data: pointsData } = await supabase
      .from("pontos")
      .select("pontos")
      .eq("user_id", userId)
      .maybeSingle();

    setPoints(pointsData?.pontos || 0);

    // Load available redemptions
    const { data: redemptionsData } = await supabase
      .from("resgates")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "available");

    setRedemptions(redemptionsData?.length || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/");
  };

  const pointsProgress = (points % 5) * 20;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoDub} alt="DUB" className="w-10 h-10" />
            <div>
              <h1 className="font-bold">Barbearia DUB</h1>
              <p className="text-xs text-muted-foreground">{profile?.nome || user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Points Card */}
        <Card className="p-6 card-premium">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Programa de Pontos</h3>
              <p className="text-xs text-muted-foreground">A cada 5 cortes, ganhe 1 grátis</p>
            </div>
            <Gift className="w-8 h-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{points % 5} de 5 cortes</span>
              <span className="text-primary font-semibold">{redemptions} disponíveis</span>
            </div>
            <Progress value={pointsProgress} className="h-2" />
          </div>
        </Card>

        {/* Schedule Button */}
        <Button 
          className="w-full h-14 bg-primary hover:bg-primary/90 text-base"
          onClick={() => navigate("/cliente/agendar")}
        >
          <Calendar className="mr-2 w-5 h-5" />
          Agendar Horário
        </Button>

        {/* Appointments */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Meus Agendamentos</h3>
          
          {appointments.length === 0 ? (
            <Card className="p-8 text-center card-premium">
              <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Você ainda não tem agendamentos
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <Card key={apt.id} className="p-4 card-premium">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{apt.servico.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(apt.data).toLocaleDateString("pt-BR")} às {apt.hora}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      apt.status === "confirmed" 
                        ? "bg-primary/20 text-primary" 
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {apt.status === "confirmed" ? "Confirmado" : apt.status}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-20 flex-col gap-2">
            <User className="w-5 h-5" />
            <span className="text-xs">Meu Perfil</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2">
            <Gift className="w-5 h-5" />
            <span className="text-xs">Planos</span>
          </Button>
        </div>
      </div>

      {/* Footer nav would go here */}
    </div>
  );
};

export default Cliente;
