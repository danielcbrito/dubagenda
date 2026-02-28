import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Crown, Banknote } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

// Premium components
import { ClientHeader } from "@/components/client/ClientHeader";
import { LoyaltyCard } from "@/components/client/LoyaltyCard";
import { PlanTrackerCard } from "@/components/client/PlanTrackerCard";
import { PlanExpiredBanner } from "@/components/client/PlanExpiredBanner";
import { PendingSubscriptionBanner } from "@/components/client/PendingSubscriptionBanner";
import { ScheduleButton } from "@/components/client/ScheduleButton";
import { AppointmentCardPremium } from "@/components/client/AppointmentCardPremium";
import { BarberReviewModal } from "@/components/client/BarberReviewModal";
import { PendingReviewBanner } from "@/components/client/PendingReviewBanner";
import { usePendingReviews } from "@/hooks/usePendingReviews";
import { useNotificationManager } from "@/hooks/useNotificationManager";

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

const Cliente = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [points, setPoints] = useState(0);
  const [redemptions, setRedemptions] = useState(0);
  const [pontosNecessarios, setPontosNecessarios] = useState(5);
  
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [completedAppointments, setCompletedAppointments] = useState(0);
  const [plansSheetOpen, setPlansSheetOpen] = useState(false);
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [payments, setPayments] = useState<any[]>([]);
  const [recentCancellations, setRecentCancellations] = useState<Appointment[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [expiredSubscription, setExpiredSubscription] = useState<any>(null);
  const [pendingSubscription, setPendingSubscription] = useState<any>(null);
  const [planUsageCount, setPlanUsageCount] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [reviewModalData, setReviewModalData] = useState<{
    appointmentId: string;
    barberId: string;
    barberName: string;
    barberPhoto: string | null;
  } | null>(null);

  // Flag para garantir que o modal só abre UMA VEZ por montagem
  const reviewTriggeredRef = useRef(false);
  // Flag para bloquear qualquer reabertura após fechar
  const reviewClosedRef = useRef(false);

  const { pendingReviews, refresh: refreshReviews } = usePendingReviews(user?.id || null);

  // Gerenciador de notificações push + som
  useNotificationManager(user?.id || null);

  /**
   * Lógica de exibição do modal de avaliação:
   * - Só aparece a cada 3 cortes concluídos (não avaliados)
   * - Se dispensado ("Não quero avaliar"), NUNCA mais aparece para esse appointment
   * - Usa localStorage para persistência permanente
   */
  const REVIEW_INTERVAL = 1; // Mostrar sempre que houver avaliação pendente

  const getDismissedIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem("dismissed_review_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const dismissReview = (appointmentId: string) => {
    const ids = getDismissedIds();
    ids.add(appointmentId);
    try {
      localStorage.setItem("dismissed_review_ids", JSON.stringify([...ids]));
    } catch { /* ignore */ }
  };

  // Eligible reviews (filtered by dismissed)
  const eligibleReviews = useMemo(() => {
    const dismissed = getDismissedIds();
    return pendingReviews.filter((r) => !dismissed.has(r.appointmentId));
  }, [pendingReviews]);

  // Auto-abrir modal — UMA ÚNICA VEZ por sessão
  useEffect(() => {
    if (!dataLoaded || reviewTriggeredRef.current || reviewClosedRef.current) return;
    
    if (eligibleReviews.length >= REVIEW_INTERVAL) {
      reviewTriggeredRef.current = true;
      const pick = eligibleReviews[0];
      setReviewModalData({
        appointmentId: pick.appointmentId,
        barberId: pick.barberId,
        barberName: pick.barberName,
        barberPhoto: pick.barberPhoto,
      });
    }
  }, [eligibleReviews, dataLoaded]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

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
            
            if (newData.visivel_para_usuario === false) {
              setAppointments(prev => prev.filter(apt => apt.id !== newData.id));
              return;
            }
            
            loadUserData(user.id);
            
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

  // Buscar pontos_necessarios da promoção ativa + realtime
  useEffect(() => {
    const fetchPontosNecessarios = async () => {
      const { data } = await supabase
        .from("promocoes")
        .select("pontos_necessarios")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      
      if (data?.pontos_necessarios && data.pontos_necessarios >= 2) {
        setPontosNecessarios(data.pontos_necessarios);
      }
    };

    fetchPontosNecessarios();

    const channel = supabase
      .channel('promocoes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promocoes' },
        () => {
          fetchPontosNecessarios();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    const { data: creditsData } = await supabase
      .rpc('get_user_available_credits', { p_user_id: userId });
    
    setAvailableCredits(creditsData || 0);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    setProfile(profileData);

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
        payment_method,
        tipo_agendamento,
        is_free,
        servico:servicos(nome),
        barbeiro:barbeiros(apelido, tenant:tenants(nome)),
        pagamentos(metodo, status)
      `)
      .eq("user_id", userId)
      .eq("visivel_para_usuario", true)
      .order("data", { ascending: false })
      .limit(5);

    setAppointments(appointmentsData || []);
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const recentlyCancelled = (appointmentsData || []).filter(apt => 
      apt.status === 'cancelled_by_admin' && 
      apt.cancelado_em &&
      new Date(apt.cancelado_em) > twoDaysAgo &&
      apt.observacoes?.includes("Cancelado em massa:")
    );
    
    setRecentCancellations(recentlyCancelled);

    const { data: paymentsData } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("user_id", userId);
    
    setPayments(paymentsData || []);

    // Buscar pontos diretamente da tabela pontos (fonte de verdade, gerenciada pelo trigger)
    const { data: pontosData } = await supabase
      .from("pontos")
      .select("pontos")
      .eq("user_id", userId)
      .maybeSingle();

    const currentPoints = pontosData?.pontos || 0;
    
    // Contar total de cortes concluídos (incluindo grátis) para estatísticas
    const { count: totalCompletedCount } = await supabase
      .from("agendamentos")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("status", "completed");

    setCompletedAppointments(totalCompletedCount || 0);

    // Buscar resgates disponíveis (verificando se não há agendamento ativo com resgate)
    const { data: activeResgateApt } = await supabase
      .from("agendamentos")
      .select("id")
      .eq("user_id", userId)
      .eq("payment_method", "resgate")
      .in("status", ["pending", "confirmed", "completed"])
      .limit(1);

    let availableRedemptions = 0;
    if (!activeResgateApt || activeResgateApt.length === 0) {
      const { data: allRedemptions } = await supabase
        .from("resgates")
        .select("id, status")
        .eq("user_id", userId)
        .eq("status", "available");
      availableRedemptions = allRedemptions?.length || 0;
    }

    setPoints(currentPoints);
    setRedemptions(availableRedemptions);

    // Buscar assinatura ativa do usuário
    const { data: activeSub } = await supabase
      .from("assinaturas")
      .select("id, status, next_billing_date, plano_id, barbeiro_id, payment_method, cash_payment_confirmed, plano:planos(nome, limite_agendamentos_mes)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSub) {
      setActiveSubscription(activeSub);
      setExpiredSubscription(null);
      setPendingSubscription(null);

      // Contar usos do plano no mês atual
      const now = new Date();
      const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      
      const { count: usageCount } = await supabase
        .from("plano_agendamentos_usos")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .is("released_at", null);

      setPlanUsageCount(usageCount || 0);
    } else {
      setActiveSubscription(null);

      // Verificar assinatura pendente (suspended ou pending_cash)
      const { data: pendingSub } = await supabase
        .from("assinaturas")
        .select("id, status, plano_id, created_at, payment_method, pix_qr_code, pix_payload, asaas_payment_id, pix_expires_at, plano:planos(nome, preco_mensal)")
        .eq("user_id", userId)
        .in("status", ["suspended", "pending_cash"] as any)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPendingSubscription(pendingSub);

      // Verificar assinatura cancelada recente (apenas se não há pendente)
      if (!pendingSub) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

        const { data: expiredSub } = await supabase
          .from("assinaturas")
          .select("id, status, plano_id, updated_at, next_billing_date, plano:planos(nome)")
          .eq("user_id", userId)
          .eq("status", "cancelled")
          .not("next_billing_date", "is", null)
          .gte("updated_at", thirtyDaysAgoISO)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Só mostra banner se a assinatura teve uma data de cobrança que já passou
        // (indicando que era uma assinatura real, não uma tentativa não finalizada)
        const isRealExpired = expiredSub?.next_billing_date && 
          new Date(expiredSub.next_billing_date + "T00:00:00") < new Date();

        setExpiredSubscription(isRealExpired ? expiredSub : null);
      } else {
        setExpiredSubscription(null);
      }

      setPlanUsageCount(0);
    }

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
        pix_qr_code,
        pix_payload,
        asaas_payment_id,
        expires_at,
        barbeiro_id,
        servico:servicos(nome)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setPendingBookings(pendingBookingsData || []);
    setDataLoaded(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/");
  };

  const handleResumePayment = (bookingId: string) => {
    const booking = pendingBookings.find(b => b.id === bookingId);

    // Se tem dados PIX e o QR Code ainda não expirou, redireciona direto para o checkout PIX
    if (booking?.pix_qr_code && booking?.pix_payload && booking?.expires_at) {
      const expiresAt = new Date(booking.expires_at).getTime();
      const now = Date.now();

      if (expiresAt > now) {
        // QR Code ainda válido — redirecionar direto
        const pixCheckoutData = {
          pixQrCode: booking.pix_qr_code,
          pixPayload: booking.pix_payload,
          pendingBookingId: booking.id,
          asaasPaymentId: booking.asaas_payment_id || "",
          expiresAt: booking.expires_at,
          value: booking.preco,
          serviceName: booking.servico?.nome || "Serviço",
          barberName: "",
          bookingDate: booking.data ? new Date(`${booking.data}T12:00:00`).toLocaleDateString("pt-BR") : "",
          bookingTime: booking.hora || "",
        };
        sessionStorage.setItem("pix_checkout_data", JSON.stringify(pixCheckoutData));
        navigate("/cliente/pix-checkout");
        return;
      }
    }

    // QR Code expirado ou não é PIX — redireciona direto para a etapa de pagamento
    const resumeData = {
      pendingBookingId: booking?.id || bookingId,
      barberId: booking?.barbeiro_id || "",
      servicoId: booking?.servico_id || "",
      serviceName: booking?.servico?.nome || "",
      date: booking?.data || "",
      time: booking?.hora || "",
      price: booking?.preco || 0,
    };
    sessionStorage.setItem("resumeToPaymentStep", JSON.stringify(resumeData));
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

    const { data: appointmentRow } = await supabase
      .from("agendamentos")
      .select("barbeiro_confirmou, ponto_liberado")
      .eq("id", appointmentId)
      .single();

    const barberConfirmed = (appointmentRow as any)?.barbeiro_confirmou;
    const pointReleased = (appointmentRow as any)?.ponto_liberado;

    if (barberConfirmed && !pointReleased) {
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

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 56px)" }}>
      <AnnouncementModal />

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain touch-pan-y [webkit-overflow-scrolling:touch] pb-24">
          <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
            {/* Header */}
            <div className="mb-5">
              <ClientHeader
                profileName={profile?.nome}
                email={user?.email}
                userId={user?.id}
              />
            </div>
            
            {/* Plan Tracker ou Loyalty Card */}
            <div className="mb-5">
              {!dataLoaded ? (
                <div className="rounded-xl h-[140px] bg-muted/10 animate-pulse" />
              ) : activeSubscription ? (
              <>
                {/* Banner para assinantes cash que ainda não confirmaram pagamento */}
                {activeSubscription.payment_method === 'cash' && activeSubscription.cash_payment_confirmed === false && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-4 mb-3 border border-amber-500/30"
                    style={{
                      background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(251,191,36,0.04))",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15">
                        <Banknote className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground">
                          Primeiro corte liberado!
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Agende e vá à barbearia — pague o valor do plano no local. Após o barbeiro confirmar, seus próximos cortes serão liberados automaticamente.
                        </p>
                        {planUsageCount === 0 && (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (activeSubscription?.barbeiro_id) {
                                navigate(`/cliente/agendar?barber=${activeSubscription.barbeiro_id}`);
                              } else {
                                navigate("/cliente/agendar");
                              }
                            }}
                            className="mt-2.5 h-8 text-xs font-semibold rounded-lg"
                          >
                            <Calendar className="w-3.5 h-3.5 mr-1.5" />
                            Agendar primeiro corte
                          </Button>
                        )}
                        {planUsageCount > 0 && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-2">
                            ⏳ Aguardando confirmação do barbeiro para liberar os demais cortes
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
                <PlanTrackerCard
                  planName={(activeSubscription as any).plano?.nome || "Meu Plano"}
                  usedAppointments={planUsageCount}
                  totalAppointments={activeSubscription.cash_payment_confirmed === false ? 1 : 4}
                  nextBillingDate={activeSubscription.next_billing_date || ""}
                  paymentMethod={activeSubscription.payment_method}
                  onViewDetails={() => setPlansSheetOpen(true)}
                />
              </>
              ) : pendingSubscription ? (
                <div className="space-y-4">
                  {(pendingSubscription as any).status === 'pending_cash' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Crown className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[13px] font-semibold text-foreground">
                            {(pendingSubscription as any).plano?.nome || "Plano"} — Aguardando pagamento
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Apresente o pagamento em dinheiro ao barbeiro. Após a confirmação, seus cortes serão liberados.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <PendingSubscriptionBanner
                      planName={(pendingSubscription as any).plano?.nome || "Plano"}
                      onFinalize={() => {
                        const ps = pendingSubscription as any;
                        if (ps.payment_method === "pix" && ps.pix_qr_code && ps.pix_expires_at) {
                          const pixExpiresAt = new Date(ps.pix_expires_at).getTime();
                          if (pixExpiresAt > Date.now()) {
                            const pixCheckoutData = {
                              pixQrCode: ps.pix_qr_code,
                              pixPayload: ps.pix_payload,
                              subscriptionId: ps.id,
                              asaasPaymentId: ps.asaas_payment_id,
                              expiresAt: ps.pix_expires_at,
                              value: ps.plano?.preco_mensal || 0,
                              planName: ps.plano?.nome || "Plano",
                            };
                            sessionStorage.setItem("subscription_pix_checkout_data", JSON.stringify(pixCheckoutData));
                            navigate("/cliente/assinatura-pix");
                            return;
                          }
                        }
                        navigate("/cliente/assinar", { 
                          state: { resumePlanId: ps.plano_id }
                        });
                      }}
                    />
                  )}
                  <LoyaltyCard
                    points={points}
                    redemptions={redemptions}
                    pontosNecessarios={pontosNecessarios}
                    onViewDetails={() => setPointsModalOpen(true)}
                  />
                </div>
              ) : expiredSubscription ? (
                <div className="space-y-4">
                  <PlanExpiredBanner
                    planName={(expiredSubscription as any).plano?.nome || "Plano"}
                    onRenew={() => navigate("/cliente/assinar")}
                  />
                  <LoyaltyCard
                    points={points}
                    redemptions={redemptions}
                    pontosNecessarios={pontosNecessarios}
                    onViewDetails={() => setPointsModalOpen(true)}
                  />
                </div>
              ) : (
                <LoyaltyCard
                  points={points}
                  redemptions={redemptions}
                  pontosNecessarios={pontosNecessarios}
                  onViewDetails={() => setPointsModalOpen(true)}
                />
              )}
            </div>

            {/* Schedule Button */}
            <div className="mb-6">
              <ScheduleButton onClick={() => {
                // Se tem assinatura ativa com barbeiro vinculado, passa direto
                if (activeSubscription?.barbeiro_id) {
                  navigate(`/cliente/agendar?barber=${activeSubscription.barbeiro_id}`);
                } else {
                  navigate("/cliente/agendar");
                }
              }} />
            </div>

            {/* Pending Bookings */}
            <AnimatePresence>
              {pendingBookings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5"
                >
                  <p className="text-[8px] font-semibold text-muted-foreground/30 uppercase tracking-[0.2em] mb-2.5">
                    Pagamentos Pendentes
                  </p>
                  <div className="space-y-3">
                    {pendingBookings.map((booking) => (
                      <PendingPaymentCard
                        key={booking.id}
                        booking={booking}
                        onResumePayment={handleResumePayment}
                        onCancel={handleCancelPendingBooking}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pending Review Banners */}
            {eligibleReviews.length > 0 && (
              <div className="space-y-2.5 mb-4">
                {eligibleReviews.slice(0, 2).map((review) => (
                  <PendingReviewBanner
                    key={review.appointmentId}
                    barberName={review.barberName}
                    barberPhoto={review.barberPhoto}
                    serviceName={review.serviceName}
                    date={review.data}
                    onReview={() => {
                      setReviewModalData({
                        appointmentId: review.appointmentId,
                        barberId: review.barberId,
                        barberName: review.barberName,
                        barberPhoto: review.barberPhoto,
                      });
                    }}
                  />
                ))}
              </div>
            )}

            {/* Appointments Section */}
            <div>
              <p className="text-[8px] font-semibold text-muted-foreground/30 uppercase tracking-[0.2em] mb-2.5">
                Meus Agendamentos
              </p>
              
              {/* Recent Cancellation Banners */}
              <AnimatePresence>
                {recentCancellations.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 mb-4"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
              
              {appointments.length === 0 && pendingBookings.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-xl border border-dashed border-border/20 p-6 text-center bg-card/20"
                >
                  <div className="w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center bg-muted/10">
                    <Calendar className="w-5 h-5 text-muted-foreground/20" />
                  </div>
                  <p className="text-[12px] text-muted-foreground/50 font-medium">
                    Nenhum agendamento
                  </p>
                  <p className="text-[10px] text-muted-foreground/30 mt-0.5">
                    Toque em "Agendar Horário" acima
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt, index) => (
                    <AppointmentCardPremium
                      key={apt.id}
                      appointment={apt}
                      onCancel={() => loadUserData(user.id)}
                      onConfirm={handleConfirmAppointment}
                      userId={user?.id}
                      payments={payments}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* My Plans Sheet */}
      <MyPlansSheet
        open={plansSheetOpen}
        onOpenChange={setPlansSheetOpen}
        userId={user?.id}
        onSubscriptionChanged={() => user && loadUserData(user.id)}
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
        credits={availableCredits}
        points={points}
        completedAppointments={completedAppointments}
        redemptions={redemptions}
        pontosNecessarios={pontosNecessarios}
      />

      {/* Points Detail Modal */}
      <PointsDetailModal
        open={pointsModalOpen}
        onOpenChange={setPointsModalOpen}
        points={points}
        completedAppointments={completedAppointments}
        redemptions={redemptions}
        pontosNecessarios={pontosNecessarios}
      />

      {/* Wallet Sheet */}
      <WalletSheet
        open={walletSheetOpen}
        onOpenChange={setWalletSheetOpen}
        userId={user?.id}
      />

      {/* Announcement Dialog */}
      <AnnouncementDialog />

      {/* History Sheet */}
      <AppointmentHistorySheet
        open={historySheetOpen}
        onOpenChange={setHistorySheetOpen}
        userId={user?.id}
      />

      {/* Modal de Avaliação */}
      <BarberReviewModal
        open={!!reviewModalData}
        onOpenChange={(open) => {
          if (!open) {
            // Bloqueia QUALQUER reabertura
            reviewClosedRef.current = true;
            if (reviewModalData) {
              dismissReview(reviewModalData.appointmentId);
            }
            setReviewModalData(null);
          }
        }}
        appointmentId={reviewModalData?.appointmentId || ""}
        barberId={reviewModalData?.barberId || ""}
        barberName={reviewModalData?.barberName || ""}
        barberPhoto={reviewModalData?.barberPhoto || null}
        userId={user?.id || ""}
        userName={profile?.nome || "Cliente"}
        onSuccess={() => {
          reviewClosedRef.current = true;
          if (reviewModalData) {
            dismissReview(reviewModalData.appointmentId);
          }
          refreshReviews();
        }}
      />

      {/* Bottom Navigation */}
      <BottomNavigation
        onProfileClick={() => setProfileSheetOpen(true)}
        onSupportClick={() => navigate('/suporte')}
      />
    </div>
  );
};

export default Cliente;
