import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Crown, 
  Store, 
  ChevronRight, 
  Scissors, 
  MapPin, 
  Search, 
  Clock, 
  Star,
  Wallet,
  Gift,
  History,
  Bell,
  User,
  LogOut
} from "lucide-react";
import { toast } from "sonner";
import { useDataError } from "@/hooks/useDataError";
import { useBlockedBarbers } from "@/hooks/useBlockedBarbers";

import { supabase } from "@/integrations/supabase/client";
import { getVerifiedAuthUser } from "@/utils/authSession";

import { PointsDetailModal } from "@/components/PointsDetailModal";
import { PendingPaymentCard } from "@/components/PendingPaymentCard";
import { MyPlansSheet } from "@/components/MyPlansSheet";
import { SubscribePlanSheet } from "@/components/SubscribePlanSheet";
import { MyProfileSheet } from "@/components/MyProfileSheet";
import { WalletSheet } from "@/components/WalletSheet";
import { AnnouncementDialog } from "@/components/AnnouncementDialog";
import { CancelledAppointmentBanner } from "@/components/CancelledAppointmentBanner";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { BottomNavigation } from "@/components/BottomNavigation";
import { AppointmentHistorySheet } from "@/components/AppointmentHistorySheet";
import { cn } from "@/lib/utils";

// Premium components
import { ClientHeader } from "@/components/client/ClientHeader";
import { LoyaltyCard } from "@/components/client/LoyaltyCard";
import { PlanTrackerCard } from "@/components/client/PlanTrackerCard";
import { PlanExpiredBanner } from "@/components/client/PlanExpiredBanner";
import { PlanRenewalDrawer } from "@/components/client/PlanRenewalDrawer";
import { PendingSubscriptionDrawer } from "@/components/client/PendingSubscriptionDrawer";
import { ScheduleButton } from "@/components/client/ScheduleButton";
import { AppointmentCardPremium } from "@/components/client/AppointmentCardPremium";
import { BarberReviewModal } from "@/components/client/BarberReviewModal";
import { PendingReviewBanner } from "@/components/client/PendingReviewBanner";
import { usePendingReviews } from "@/hooks/usePendingReviews";
import { useNotificationManager } from "@/hooks/useNotificationManager";
import { useCancelarReservaPendente, useCancelSubscriptionMutation } from "@/hooks/useClientMutations";
import { usePendingSubscription } from "@/hooks/usePendingSubscription";

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
  payment_method?: string | null;
  tipo_agendamento?: string | null;
  is_free?: boolean | null;
  barbeiro?: { apelido: string; tenant?: { nome: string } | null } | null;
  pagamentos?: Array<{
    metodo: string;
    status: string;
  }>;
}

// ─── Shop query function ───
const fetchShopData = async (tenantId: string) => {
  const { data: barbers, error } = await supabase
    .from("barbeiros")
    .select("id, apelido, foto_url, barbeiro_avaliacoes(rating)")
    .eq("ativo", true)
    .is("deleted_at", null)
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const shopBarbers = (barbers || []).map((b: any) => {
    const ratings: number[] = (b.barbeiro_avaliacoes || []).map((r: any) => r.rating);
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;
    return { id: b.id, apelido: b.apelido, foto_url: b.foto_url, avgRating, totalReviews: ratings.length };
  });

  return { shopBarbers };
};

// ─── Profile query function ───
const fetchProfileData = async (userId: string) => {
  const { data: prof, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!prof) {
    await supabase.auth.signOut({ scope: "local" });
    throw new Error("Sessão inválida. Entre novamente.");
  }

  let preferredShop: { id: string; nome: string } | null = null;
  const tenantId = prof?.barbearia_preferida_id;
  if (tenantId) {
    const { data: tenant } = await supabase.from("tenants").select("id, nome").eq("id", tenantId).single();
    if (tenant) preferredShop = tenant;
  }

  return { profile: prof, preferredShop };
};

// ─── Appointments query function ───
const fetchAppointmentsData = async (userId: string) => {
  const appointmentSelect = `
    id, data, hora, status, preco, observacoes,
    cliente_confirmou, barbeiro_confirmou,
    remarcacao_solicitada, motivo_remarcacao, payment_method, tipo_agendamento, is_free,
    servico:servicos(nome),
    barbeiro:barbeiros(apelido, tenant:tenants(nome)),
    pagamentos(metodo, status)
  `;

  const [appointmentsResult, paymentsResult, pendingBookingsResult, cancellationsResult] = await Promise.all([
    supabase.from("agendamentos").select(appointmentSelect)
      .eq("user_id", userId)
      .in("status", ["pending", "confirmed", "completed", "no_show"])
      .or(`visivel_para_usuario.eq.true,payment_method.eq.plano`)
      .order("data", { ascending: false })
      .limit(20),
    supabase.from("pagamentos").select("id, metodo, status, agendamento_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("pending_bookings").select(`
      id, data, hora, servico_id, preco, payment_method, created_at,
      pix_qr_code, pix_payload, asaas_payment_id, expires_at, barbeiro_id,
      servico:servicos(nome)
    `).eq("user_id", userId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("agendamentos").select(appointmentSelect)
      .eq("user_id", userId)
      .eq("status", "cancelled_by_admin")
      .eq("visivel_para_usuario", true)
      .gte("cancelado_em", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5),
  ]);

  const recentlyCancelled = (cancellationsResult.data || []).filter((apt: any) =>
    apt.observacoes?.includes("Cancelado em massa:")
  );
  const recentCancelledAppointments = (cancellationsResult.data || []) as Appointment[];
  const activeAppointments = (appointmentsResult.data || []) as Appointment[];
  const appointmentMap = new Map<string, Appointment>();

  [...recentCancelledAppointments, ...activeAppointments].forEach((apt) => {
    appointmentMap.set(apt.id, apt);
  });

  return {
    appointments: Array.from(appointmentMap.values()).sort((a, b) =>
      `${b.data}T${b.hora}`.localeCompare(`${a.data}T${a.hora}`)
    ),
    payments: paymentsResult.data || [],
    pendingBookings: pendingBookingsResult.data || [],
    recentCancellations: recentlyCancelled as Appointment[],
  };
};

// ─── Loyalty query function ───
const fetchLoyaltyData = async (userId: string, tenantId: string | null) => {
  const [
    creditsResult,
    pontosResult,
    completedCountResult,
    activeResgateResult,
    redemptionsResult,
    pontosNecessariosResult,
    activeSubResult,
    pendingSubResult,
  ] = await Promise.all([
    supabase.rpc('get_user_available_credits', { p_user_id: userId }),
    supabase.from("pontos").select("pontos").eq("user_id", userId).maybeSingle(),
    supabase.from("agendamentos").select("*", { count: 'exact', head: true }).eq("user_id", userId).eq("status", "completed"),
    supabase.from("agendamentos").select("id").eq("user_id", userId).eq("payment_method", "resgate").in("status", ["pending", "confirmed", "completed"]).limit(1),
    supabase.from("resgates").select("id, status").eq("user_id", userId).eq("status", "available"),
    tenantId
      ? supabase.from("promocoes").select("pontos_necessarios").eq("ativo", true).eq("tenant_id", tenantId).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    supabase.from("assinaturas").select("id, status, next_billing_date, plano_id, barbeiro_id, payment_method, cash_payment_confirmed, ciclo_inicio, ciclo_fim, usos_ciclo_atual, plano:planos(nome, limite_agendamentos_mes, preco_mensal, servico:servicos!planos_servico_id_fkey(nome))").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("assinaturas").select("id, status, plano_id, barbeiro_id, created_at, payment_method, pix_qr_code, pix_payload, asaas_payment_id, pix_expires_at, plano:planos(nome, preco_mensal), barbeiro:barbeiros(apelido)").eq("user_id", userId).in("status", ["suspended", "pending_cash", "pending_renewal"] as any).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const points = pontosResult.data?.pontos || 0;
  const completedAppointments = completedCountResult.count || 0;
  const credits = creditsResult.data || 0;
  let availableRedemptions = 0;
  if (!activeResgateResult.data || activeResgateResult.data.length === 0) {
    availableRedemptions = redemptionsResult.data?.length || 0;
  }
  const loyaltyEnabled = !!tenantId && !!pontosNecessariosResult.data;
  const pontosNecessarios = (pontosNecessariosResult.data?.pontos_necessarios && pontosNecessariosResult.data.pontos_necessarios >= 2) ? pontosNecessariosResult.data.pontos_necessarios : 8;

  let activeSubscription: any = null;
  let expiredSubscription: any = null;
  let planUsageCount = 0;
  const activeSubData = activeSubResult.data;
  if (activeSubData) {
    activeSubscription = activeSubData;
    let cycleStartDate: string;
    let cycleEndDate: string;
    if (activeSubData.ciclo_inicio && activeSubData.ciclo_fim) {
      cycleStartDate = activeSubData.ciclo_inicio;
      cycleEndDate = activeSubData.ciclo_fim;
    } else {
      const cs = new Date(`${activeSubData.next_billing_date}T12:00:00`);
      cs.setMonth(cs.getMonth() - 1);
      cycleStartDate = cs.toISOString().split('T')[0];
      cycleEndDate = activeSubData.next_billing_date;
    }
    const { data: usageCount } = await supabase.rpc('count_subscription_uses_in_cycle', {
      p_assinatura_id: activeSubData.id,
      p_cycle_start: cycleStartDate,
      p_cycle_end: cycleEndDate,
    });
    planUsageCount = Math.max(Number(activeSubData.usos_ciclo_atual || 0), Number(usageCount || 0));
  }
  
  const pendingSubscription = pendingSubResult.data;
  if (!activeSubscription && !pendingSubscription) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: expiredSub } = await supabase.from("assinaturas").select("id, status, plano_id, updated_at, next_billing_date, plano:planos(nome)").eq("user_id", userId).eq("status", "cancelled").not("next_billing_date", "is", null).gte("updated_at", thirtyDaysAgo.toISOString()).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const isRealExpired = expiredSub?.next_billing_date && new Date(expiredSub.next_billing_date + "T00:00:00") < new Date();
    expiredSubscription = isRealExpired ? expiredSub : null;
  }

  return {
    points,
    completedAppointments,
    credits,
    redemptions: availableRedemptions,
    activeSubscription,
    pendingSubscription,
    expiredSubscription,
    planUsageCount,
    pontosNecessarios,
    loyaltyEnabled,
  };
};

/** Minimal loading fallback */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-dvh bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

interface ProfileItemProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: string;
  danger?: boolean;
}

function ProfileItem({ icon: Icon, label, onClick, badge, danger }: ProfileItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between py-4 border-b border-border/10 last:border-0 transition-all active:opacity-60",
        danger && "text-destructive"
      )}
    >
      <div className="flex items-center gap-4">
        <Icon className={cn("w-5 h-5", danger ? "text-destructive" : "text-foreground/80")} strokeWidth={1.5} />
        <span className="text-[14px] font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
            {badge}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
      </div>
    </button>
  );
}

const Cliente = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getVerifiedAuthUser().then(u => {
      if (!u) navigate("/auth");
      else setUser(u);
    });
  }, [navigate]);

  const { data: profileQueryData, isLoading: profileLoading } = useQuery({
    queryKey: ['cliente', 'profile', user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user?.id,
    staleTime: 10 * 1000,
  });

  const profile = profileQueryData?.profile ?? null;
  const preferredShop = profileQueryData?.preferredShop ?? null;
  const tenantId = profile?.barbearia_preferida_id ?? null;

  const { data: appointmentsQueryData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['cliente', 'appointments', user?.id],
    queryFn: () => fetchAppointmentsData(user!.id),
    enabled: !!user?.id,
    staleTime: 15 * 1000,
  });

  const appointments = appointmentsQueryData?.appointments ?? [];
  const pendingBookings = appointmentsQueryData?.pendingBookings ?? [];

  const { data: loyaltyQueryData, isLoading: loyaltyLoading } = useQuery({
    queryKey: ['cliente', 'loyalty', user?.id, tenantId],
    queryFn: () => fetchLoyaltyData(user!.id, tenantId),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  const points = loyaltyQueryData?.points ?? 0;
  const completedAppointments = loyaltyQueryData?.completedAppointments ?? 0;
  const availableCredits = loyaltyQueryData?.credits ?? 0;
  const activeSubscription = loyaltyQueryData?.activeSubscription ?? null;
  const { data: directPendingSubscription } = usePendingSubscription(user?.id);
  const pendingSubscription = loyaltyQueryData?.pendingSubscription ?? directPendingSubscription ?? null;
  const expiredSubscription = loyaltyQueryData?.expiredSubscription ?? null;
  const planUsageCount = loyaltyQueryData?.planUsageCount ?? 0;
  const redemptions = loyaltyQueryData?.redemptions ?? 0;
  const pontosNecessarios = loyaltyQueryData?.pontosNecessarios ?? 8;
  const loyaltyEnabled = loyaltyQueryData?.loyaltyEnabled ?? false;
  
  const { data: notificationsData } = useQuery({
    queryKey: ['cliente', 'notifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("notificacoes").select("id, lida").eq("user_id", user?.id).eq("lida", false);
      return data || [];
    },
    enabled: !!user?.id,
  });
  const unreadNotifs = notificationsData?.length || 0;

  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [plansSheetOpen, setPlansSheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [renewalDrawerOpen, setRenewalDrawerOpen] = useState(false);
  const [pendingDrawerOpen, setPendingDrawerOpen] = useState(false);
  const { cancelSubscription } = useCancelSubscriptionMutation();
  const { cancelarReserva } = useCancelarReservaPendente();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/auth");
  };

  const handleCancelarReserva = (id: string) => {
    const booking = pendingBookings.find((b: any) => b.id === id);
    cancelarReserva({ bookingId: id, asaasPaymentId: booking?.asaas_payment_id || null });
  };

  if (profileLoading || !user) return <PageLoader />;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 min-h-0 relative">
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="max-w-lg mx-auto">
            <div className="px-5 pt-5 pb-3">
              <ClientHeader profileName={profile?.nome} userId={user?.id} />
            </div>

            <div className="px-5 pb-24 space-y-6">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <div onClick={() => setWalletSheetOpen(true)} className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden active:scale-[0.99] transition-transform cursor-pointer">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">Minha Carteira</p>
                        <p className="text-[17px] font-bold text-foreground tabular-nums">
                          R$ {availableCredits.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                  </div>
                  <div className="px-4 py-2.5 bg-muted/30 border-t border-border/20">
                    <p className="text-[10px] text-muted-foreground/60">Gerencie seus créditos e reembolsos</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => navigate("/cliente/indicacoes")}
                className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-secondary" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">Indique e Ganhe</p>
                      <h3 className="text-[14px] font-bold text-foreground">Meus Pontos Decolar</h3>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                </div>
                <div className="px-4 py-2.5 bg-muted/30 border-t border-border/20">
                  <p className="text-[10px] text-muted-foreground/60">Convidar amigos para ganhar cortes</p>
                </div>
              </motion.div>


              {activeSubscription && (
                <PlanTrackerCard
                  planName={activeSubscription.plano.nome}
                  usedAppointments={planUsageCount}
                  totalAppointments={activeSubscription.plano.limite_agendamentos_mes}
                  nextBillingDate={activeSubscription.next_billing_date}
                  servicoNome={activeSubscription.plano.servico?.nome}
                  onViewDetails={() => setPlansSheetOpen(true)}
                  cashPending={activeSubscription.payment_method === 'cash' && !activeSubscription.cash_payment_confirmed}
                />
              )}

              {loyaltyEnabled && (
                <LoyaltyCard points={points} redemptions={redemptions} pontosNecessarios={pontosNecessarios} onViewDetails={() => setPointsModalOpen(true)} />
              )}

              <div className="space-y-1 pt-2">
                <ProfileItem icon={History} label="Conversas" onClick={() => {}} />
                <ProfileItem icon={Bell} label="Notificações" onClick={() => {}} badge={unreadNotifs > 0 ? String(unreadNotifs) : undefined} />
                <ProfileItem icon={Crown} label="Clube Dub" onClick={() => setPlansSheetOpen(true)} />
                <ProfileItem icon={Gift} label="Cupons" onClick={() => {}} />
                <ProfileItem icon={History} label="Histórico" onClick={() => setHistorySheetOpen(true)} />
                <ProfileItem icon={Store} label="Minha Barbearia" onClick={() => navigate("/cliente/barbearia")} />
                <ProfileItem icon={User} label="Minha Conta" onClick={() => navigate("/cliente/perfil")} />
                <ProfileItem icon={LogOut} label="Sair da Conta" danger onClick={handleLogout} />
              </div>

            </div>
          </div>
        </div>
      </div>

      <BottomNavigation onProfileClick={() => navigate("/cliente/perfil")} onPlansClick={() => setPlansSheetOpen(true)} />
      
      <WalletSheet open={walletSheetOpen} onOpenChange={setWalletSheetOpen} userId={user?.id} profile={profile} />
      <MyPlansSheet open={plansSheetOpen} onOpenChange={setPlansSheetOpen} userId={user?.id} />
      <PointsDetailModal open={pointsModalOpen} onOpenChange={setPointsModalOpen} points={points} completedAppointments={completedAppointments} redemptions={redemptions} pontosNecessarios={pontosNecessarios} />
      <AppointmentHistorySheet open={historySheetOpen} onOpenChange={setHistorySheetOpen} userId={user?.id} />
    </div>
  );
};

export default Cliente;