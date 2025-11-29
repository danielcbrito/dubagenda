import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Gift, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { ClientDrawerMenu } from "@/components/ClientDrawerMenu";
import { PointsDetailModal } from "@/components/PointsDetailModal";
import { AppointmentCard } from "@/components/AppointmentCard";
import { PendingPaymentCard } from "@/components/PendingPaymentCard";
import { NotificationBell } from "@/components/NotificationBell";
import { MyPlansSheet } from "@/components/MyPlansSheet";
import { SubscribePlanSheet } from "@/components/SubscribePlanSheet";
import { MyProfileSheet } from "@/components/MyProfileSheet";
import { WalletSheet } from "@/components/WalletSheet";
import { AnnouncementDialog } from "@/components/AnnouncementDialog";
import { CancelledAppointmentBanner } from "@/components/CancelledAppointmentBanner";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { SupportChatBubble } from "@/components/support/SupportChatBubble";

interface Appointment {
  id: string;
  data: string;
  hora: string;
  servico: { nome: string };
  status: string;
  duracao?: number;
  preco?: number;
  observacoes?: string;
  cancelado_em?: string;
  visivel_para_usuario?: boolean;
  cliente_confirmou?: boolean;
  barbeiro_confirmou?: boolean;
  ponto_liberado?: boolean;
  remarcacao_solicitada?: boolean;
  motivo_remarcacao?: string;
  pagamentos?: Array<{
    metodo: string;
    status: string;
  }>;
}

const Cliente = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [points, setPoints] = useState(0);
  const [redemptions, setRedemptions] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [completedAppointments, setCompletedAppointments] = useState(0);
  const [plansSheetOpen, setPlansSheetOpen] = useState(false);
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [payments, setPayments] = useState<any[]>([]);
  const [recentCancellations, setRecentCancellations] = useState<Appointment[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Set up realtime listener for appointments
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Appointment change detected:', payload);
          
          if (payload.eventType === 'INSERT') {
            loadUserData(user.id);
            toast.success("Novo agendamento recebido!");
          } else if (payload.eventType === 'DELETE') {
            setAppointments(prev => prev.filter(apt => apt.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            
            // If marked as not visible, remove from list
            if (newData.visivel_para_usuario === false) {
              setAppointments(prev => prev.filter(apt => apt.id !== newData.id));
              return;
            }
            
            // Update appointment in state
            loadUserData(user.id);
            
            // Show notification based on status change
            if (newData.status === 'confirmed' && payload.old.status !== 'confirmed') {
              toast.success("✅ Agendamento confirmado pelo barbeiro!");
            } else if (newData.status === 'completed') {
              toast.success("🎉 Atendimento concluído!");
            } else if (newData.status === 'cancelled_by_admin') {
              toast.error("❌ Agendamento cancelado pela barbearia");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fallback polling every 20 seconds to ensure UI stays in sync
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadUserData(user.id);
    }, 20000);
    return () => clearInterval(interval);
  }, [user]);

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
    // Load available credits
    const { data: creditsData } = await supabase
      .rpc('get_user_available_credits', { p_user_id: userId });
    
    setAvailableCredits(creditsData || 0);

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    setProfile(profileData);

    // Load appointments (excluding hidden ones)
    const { data: appointmentsData } = await supabase
      .from("agendamentos")
      .select(`
        id,
        data,
        hora,
        status,
        duracao,
        preco,
        observacoes,
        cancelado_em,
        visivel_para_usuario,
        cliente_confirmou,
        barbeiro_confirmou,
        ponto_liberado,
        remarcacao_solicitada,
        motivo_remarcacao,
        servico:servicos(nome),
        pagamentos(metodo, status)
      `)
      .eq("user_id", userId)
      .eq("visivel_para_usuario", true)
      .order("data", { ascending: false })
      .limit(5);

    setAppointments(appointmentsData || []);
    
    // Filtrar cancelamentos recentes pelo admin (últimas 48h)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const recentlyCancelled = (appointmentsData || []).filter(apt => 
      apt.status === 'cancelled_by_admin' && 
      apt.cancelado_em &&
      new Date(apt.cancelado_em) > twoDaysAgo &&
      apt.observacoes?.includes("Cancelado em massa:")
    );
    
    setRecentCancellations(recentlyCancelled);

    // Load payments for appointments
    const { data: paymentsData } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("user_id", userId);
    
    setPayments(paymentsData || []);

    // Load completed appointments count
    const { count } = await supabase
      .from("agendamentos")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("status", "completed");

    setCompletedAppointments(count || 0);

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

    // Load pending bookings (awaiting payment)
    const { data: pendingBookingsData } = await supabase
      .from("pending_bookings")
      .select(`
        id,
        data,
        hora,
        servico_id,
        preco,
        payment_method,
        created_at,
        servico:servicos(nome)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setPendingBookings(pendingBookingsData || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/");
  };

  const handleResumePayment = (bookingId: string) => {
    // Store pending booking ID and navigate to payment screen
    sessionStorage.setItem('resumePendingBookingId', bookingId);
    navigate("/cliente/agendar");
  };

  const handleCancelPendingBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from("pending_bookings")
        .delete()
        .eq("id", bookingId);

      if (error) throw error;

      setPendingBookings(prev => prev.filter(b => b.id !== bookingId));
      toast.success("Reserva cancelada");
    } catch (error) {
      console.error("Error canceling pending booking:", error);
      toast.error("Erro ao cancelar reserva");
    }
  };


  const handleConfirmAppointment = async (appointmentId: string) => {
    const { error } = await supabase
      .from("agendamentos")
      .update({ cliente_confirmou: true } as any)
      .eq("id", appointmentId);

    if (error) {
      toast.error("Erro ao confirmar atendimento");
      return;
    }

    // Check if barber also confirmed
    const { data: appointment } = await supabase
      .from("agendamentos")
      .select("barbeiro_confirmou, ponto_liberado") as any;

    // Fallback fetch for the specific appointment
    const { data: appointmentRow } = await supabase
      .from("agendamentos")
      .select("barbeiro_confirmou, ponto_liberado")
      .eq("id", appointmentId)
      .single();

    const barberConfirmed = (appointment as any)?.barbeiro_confirmou ?? (appointmentRow as any)?.barbeiro_confirmou;
    const pointReleased = (appointment as any)?.ponto_liberado ?? (appointmentRow as any)?.ponto_liberado;

    if (barberConfirmed && !pointReleased) {
      // Both confirmed, award point and complete
      const { error: pointError } = await supabase
        .from("agendamentos")
        .update({ 
          ponto_liberado: true,
          status: 'completed' as any
        } as any)
        .eq("id", appointmentId);

      if (!pointError) {
        toast.success("🎉 Atendimento confirmado! 1 ponto adicionado ao seu programa de fidelidade.");
        if (user) loadUserData(user.id);
      }
    } else {
      toast.success("✅ Aguardando confirmação do barbeiro");
    }
  };

  const pointsProgress = (points % 5) * 20;
  const cutsUntilFree = 5 - (points % 5);

  return (
    <div className="h-screen bg-background relative overflow-hidden flex flex-col">
      <AnnouncementModal />
      
      {/* Background Image with Blur */}
      <div 
        className="absolute inset-0 opacity-[0.08] bg-cover bg-center pointer-events-none"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=80')",
          filter: "blur(8px) grayscale(50%)"
        }}
      />

      {/* Transparent Navbar with Blur - Compact */}
      <div className="z-50 backdrop-blur-xl bg-background/30 border-b border-border/20 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-3 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoDub} alt="DUB" className="w-8 h-8" />
            <div>
              <h1 className="font-bold text-xs">Barbearia DUB</h1>
              <p className="text-[9px] text-muted-foreground">{profile?.nome || user?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {user && <NotificationBell userId={user.id} />}
            <Button
              variant="ghost" 
              size="icon"
              onClick={() => setDrawerOpen(true)}
              className="h-8 w-8 hover:bg-primary/10 transition-all duration-300"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-hidden relative z-10">
        <div className="h-full scrollable-content">
          <div className="max-w-4xl mx-auto px-3 py-4 space-y-4">
            {/* 💎 Premium Points Card - Compact */}
            <Card className="card-glass overflow-hidden border border-gold/20 shadow-glow-gold hover:scale-[1.01] transition-all duration-500">
              <div 
                className="p-4 relative"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--gold) / 0.1) 100%)"
                }}
              >
                {/* Glow effect */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold tracking-wide">Programa de Pontos</h3>
                      <p className="text-[10px] text-muted-foreground">A cada 5 cortes, ganhe 1 grátis</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-gold/30 blur-lg animate-pulse" />
                      <Gift className="relative w-6 h-6 text-gold" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{points % 5} de 5 cortes</span>
                      <span className="text-gold font-bold text-xs flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
                        {redemptions} {redemptions === 1 ? 'disponível' : 'disponíveis'}
                      </span>
                    </div>
                    
                    <Progress value={pointsProgress} className="h-1.5 bg-secondary/50" />
                    
                    <p className="text-[10px] text-center text-muted-foreground font-medium">
                      Faltam {cutsUntilFree} {cutsUntilFree === 1 ? 'corte' : 'cortes'} para o próximo grátis 🎁
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPointsModalOpen(true)}
                    className="w-full mt-3 h-8 text-[10px] hover:bg-gold/10 hover:text-gold transition-all duration-300 font-semibold"
                  >
                    Ver detalhes completos
                  </Button>
                </div>
              </div>
            </Card>

            {/* 🔥 Premium Schedule Button - Compact */}
            <Button 
              className="relative w-full h-12 bg-gradient-primary text-sm font-bold tracking-wide overflow-hidden group shadow-glow-red hover:shadow-premium-hover transition-all duration-300 hover:scale-[1.01]"
              onClick={() => navigate("/cliente/agendar")}
            >
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              
              <div className="relative flex items-center justify-center gap-2">
                <Calendar className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                <span>Agendar Horário</span>
              </div>
            </Button>

            {/* Pending Bookings - Awaiting Payment */}
            {pendingBookings.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-3">Pagamentos Pendentes</h3>
                <div className="space-y-2">
                  {pendingBookings.map((booking) => (
                    <PendingPaymentCard
                      key={booking.id}
                      booking={booking}
                      onResumePayment={handleResumePayment}
                      onCancel={handleCancelPendingBooking}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Appointments */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Meus Agendamentos</h3>
              
              {/* Banner de Cancelamento Recente */}
              {recentCancellations.length > 0 && (
                <div className="space-y-3 mb-4">
                  {recentCancellations.map(apt => {
                    const reason = apt.observacoes?.replace("Cancelado em massa: ", "") || "Não informado";
                    return (
                      <CancelledAppointmentBanner
                        key={apt.id}
                        reason={reason}
                        serviceName={apt.servico?.nome || "Serviço"}
                        date={apt.data}
                        time={apt.hora}
                      />
                    );
                  })}
                </div>
              )}
              
              {appointments.length === 0 && pendingBookings.length === 0 ? (
                <Card className="p-6 text-center border-dashed">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">
                    Você ainda não tem agendamentos
                  </p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onCancel={() => loadUserData(user.id)}
                      onConfirm={handleConfirmAppointment}
                      userId={user?.id}
                      payments={payments}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer Menu */}
      <ClientDrawerMenu
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onLogout={handleLogout}
        profile={profile}
        userId={user?.id}
        onProfileClick={() => setProfileSheetOpen(true)}
        onPlansClick={() => setPlansSheetOpen(true)}
        onPointsClick={() => setPointsModalOpen(true)}
        onWalletClick={() => setWalletSheetOpen(true)}
      />

      {/* My Plans Sheet */}
      <MyPlansSheet
        open={plansSheetOpen}
        onOpenChange={setPlansSheetOpen}
        userId={user?.id}
      />

      {/* Subscribe Plan Sheet */}
      <SubscribePlanSheet
        open={subscribeSheetOpen}
        onOpenChange={setSubscribeSheetOpen}
        userId={user?.id}
      />

      {/* My Profile Sheet */}
      <MyProfileSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        userId={user?.id}
        profile={profile}
        onProfileUpdate={() => {
          if (user) loadUserData(user.id);
        }}
      />

      {/* Points Detail Modal */}
      <PointsDetailModal
        open={pointsModalOpen}
        onOpenChange={setPointsModalOpen}
        points={points}
        completedAppointments={completedAppointments}
        redemptions={redemptions}
      />


      {/* Wallet Sheet */}
      <WalletSheet
        open={walletSheetOpen}
        onOpenChange={setWalletSheetOpen}
        userId={user?.id}
      />

      {/* Announcement Dialog */}
      <AnnouncementDialog />

      {/* Bolinha de chat de suporte */}
      <SupportChatBubble />
    </div>
  );
};

export default Cliente;
