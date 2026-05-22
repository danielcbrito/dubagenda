import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Crown, Store, ChevronRight, Scissors, MapPin, Search, Clock } from "lucide-react";
import { toast } from "sonner";
import { useDataError } from "@/hooks/useDataError";
import { useBlockedBarbers } from "@/hooks/useBlockedBarbers";

import { supabase } from "@/integrations/supabase/client";

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
import { PlanRenewalDrawer } from "@/components/client/PlanRenewalDrawer";
import { PendingSubscriptionDrawer } from "@/components/client/PendingSubscriptionDrawer";
import { ScheduleButton } from "@/components/client/ScheduleButton";
import { AppointmentCardPremium } from "@/components/client/AppointmentCardPremium";
import { BarberReviewModal } from "@/components/client/BarberReviewModal";
import { PendingReviewBanner } from "@/components/client/PendingReviewBanner";
import { usePendingReviews } from "@/hooks/usePendingReviews";
import { useNotificationManager } from "@/hooks/useNotificationManager";
import { useCancelarReservaPendente } from "@/hooks/useClientMutations";

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

// ─── Shop query function (extracted for reuse) ───
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

// ─── Profile query function (extracted for reuse) ───
const fetchProfileData = async (userId: string) => {
  const { data: prof, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;

  let preferredShop: { id: string; nome: string } | null = null;
  const tenantId = prof?.barbearia_preferida_id;
  if (tenantId) {
    const { data: tenant } = await supabase.from("tenants").select("id, nome").eq("id", tenantId).single();
    if (tenant) preferredShop = tenant;
  }

  return { profile: prof, preferredShop };
};

// ─── Appointments query function (extracted for reuse) ───
const fetchAppointmentsData = async (userId: string) => {
  const [appointmentsResult, paymentsResult, pendingBookingsResult, cancellationsResult] = await Promise.all([
    supabase.from("agendamentos").select(`
      id, data, hora, status, preco, observacoes,
      cliente_confirmou, barbeiro_confirmou,
      remarcacao_solicitada, motivo_remarcacao, payment_method, tipo_agendamento, is_free,
      servico:servicos(nome),
      barbeiro:barbeiros(apelido, tenant:tenants(nome)),
      pagamentos(metodo, status)
    `)
      .eq("user_id", userId)
      .eq("visivel_para_usuario", true)
      .in("status", ["pending", "confirmed", "completed"])
      .order("data", { ascending: false })
      .limit(20),
    supabase.from("pagamentos").select("id, metodo, status, agendamento_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("pending_bookings").select(`
      id, data, hora, servico_id, preco, payment_method, created_at,
      pix_qr_code, pix_payload, asaas_payment_id, expires_at, barbeiro_id,
      servico:servicos(nome)
    `).eq("user_id", userId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("agendamentos").select("id, data, hora, status, observacoes, cancelado_em, servico:servicos(nome)")
      .eq("user_id", userId)
      .eq("status", "cancelled_by_admin")
      .gte("cancelado_em", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5),
  ]);

  const recentlyCancelled = (cancellationsResult.data || []).filter((apt: any) =>
    apt.observacoes?.includes("Cancelado em massa:")
  );

  return {
    appointments: (appointmentsResult.data || []) as Appointment[],
    payments: paymentsResult.data || [],
    pendingBookings: pendingBookingsResult.data || [],
    recentCancellations: recentlyCancelled as Appointment[],
  };
};

// ─── Loyalty query function (extracted for reuse) ───
const fetchLoyaltyData = async (userId: string, tenantId: string | null) => {
  // Run ALL queries in parallel — no waterfalls
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
      ? supabase
          .from("promocoes")
          .select("pontos_necessarios")
          .eq("ativo", true)
          .eq("tenant_id", tenantId)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    // Fetch active subscription in same parallel batch
    supabase
      .from("assinaturas")
      .select("id, status, next_billing_date, plano_id, barbeiro_id, payment_method, cash_payment_confirmed, ciclo_inicio, ciclo_fim, usos_ciclo_atual, plano:planos(nome, limite_agendamentos_mes, preco_mensal, servico:servicos!planos_servico_id_fkey(nome))")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Fetch pending subscription in same parallel batch
    supabase
      .from("assinaturas")
      .select("id, status, plano_id, created_at, payment_method, pix_qr_code, pix_payload, asaas_payment_id, pix_expires_at, plano:planos(nome, preco_mensal)")
      .eq("user_id", userId)
      .in("status", ["suspended", "pending_cash", "pending_renewal"] as any)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const points = pontosResult.data?.pontos || 0;
  const completedAppointments = completedCountResult.count || 0;
  const credits = creditsResult.data || 0;

  let availableRedemptions = 0;
  if (!activeResgateResult.data || activeResgateResult.data.length === 0) {
    availableRedemptions = redemptionsResult.data?.length || 0;
  }

  const loyaltyEnabled = !!tenantId && !!pontosNecessariosResult.data;
  const pontosNecessarios = (pontosNecessariosResult.data?.pontos_necessarios && pontosNecessariosResult.data.pontos_necessarios >= 2)
    ? pontosNecessariosResult.data.pontos_necessarios
    : 8;

  let activeSubscription: any = null;
  let expiredSubscription: any = null;
  let pendingSubscription: any = null;
  let planUsageCount = 0;

  const activeSubData = activeSubResult.data;

  if (activeSubData) {
    activeSubscription = activeSubData;

    // Source of truth: ciclo_inicio/ciclo_fim from the subscription itself.
    // Fallback: derive from next_billing_date (legacy rows without ciclo_inicio).
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

    const { data: usageCount, error: usageError } = await supabase.rpc('count_subscription_uses_in_cycle', {
      p_assinatura_id: activeSubData.id,
      p_cycle_start: cycleStartDate,
      p_cycle_end: cycleEndDate,
    });
    const rpcUsageCount = usageError ? 0 : Number(usageCount || 0);
    planUsageCount = Math.max(Number(activeSubData.usos_ciclo_atual || 0), rpcUsageCount);
  } else {
    const pendingSub = pendingSubResult.data;
    pendingSubscription = pendingSub;

    if (pendingSub?.status === "pending_renewal") {
      const { data: renewalCheck } = await supabase.functions.invoke("check-subscription-pix", {
        body: { subscriptionId: pendingSub.id },
      });

      if (
        renewalCheck?.status === "paid" ||
        renewalCheck?.status === "expired" ||
        renewalCheck?.status === "already_processed"
      ) {
        // Re-fetch active sub after renewal
        const { data: recoveredSub } = await supabase
          .from("assinaturas")
          .select("id, status, next_billing_date, plano_id, barbeiro_id, payment_method, cash_payment_confirmed, ciclo_inicio, ciclo_fim, usos_ciclo_atual, plano:planos(nome, limite_agendamentos_mes, preco_mensal, servico:servicos!planos_servico_id_fkey(nome))")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recoveredSub) {
          activeSubscription = recoveredSub;
          pendingSubscription = null;

          let rCycleStart: string;
          let rCycleEnd: string;
          if (recoveredSub.ciclo_inicio && recoveredSub.ciclo_fim) {
            rCycleStart = recoveredSub.ciclo_inicio;
            rCycleEnd = recoveredSub.ciclo_fim;
          } else {
            const cs = new Date(`${recoveredSub.next_billing_date}T12:00:00`);
            cs.setMonth(cs.getMonth() - 1);
            rCycleStart = cs.toISOString().split('T')[0];
            rCycleEnd = recoveredSub.next_billing_date;
          }
          const { data: usageCount, error: usageError } = await supabase.rpc('count_subscription_uses_in_cycle', {
            p_assinatura_id: recoveredSub.id,
            p_cycle_start: rCycleStart,
            p_cycle_end: rCycleEnd,
          });
          const rpcUsageCount = usageError ? 0 : Number(usageCount || 0);
          planUsageCount = Math.max(Number(recoveredSub.usos_ciclo_atual || 0), rpcUsageCount);
        }
      }
    }

    if (!pendingSub) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: expiredSub } = await supabase
        .from("assinaturas")
        .select("id, status, plano_id, updated_at, next_billing_date, plano:planos(nome)")
        .eq("user_id", userId)
        .eq("status", "cancelled")
        .not("next_billing_date", "is", null)
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isRealExpired = expiredSub?.next_billing_date &&
        new Date(expiredSub.next_billing_date + "T00:00:00") < new Date();

      expiredSubscription = isRealExpired ? expiredSub : null;
    }
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

const Cliente = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<any>(null);

  // ─── Profile via useQuery (Layer 1) ───
  const {
    data: profileQueryData,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: ['cliente', 'profile', user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user?.id,
    staleTime: 10 * 1000, // 10s — preferred shop can change in other routes
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Aliases to maintain compatibility with existing prop interfaces
  const profile = profileQueryData?.profile ?? null;
  const preferredShop = profileQueryData?.preferredShop ?? null;
  const tenantId = profile?.barbearia_preferida_id ?? null;

  // ─── Appointments via useQuery (Layer 2) ───
  const {
    data: appointmentsQueryData,
    isLoading: appointmentsLoading,
  } = useQuery({
    queryKey: ['cliente', 'appointments', user?.id],
    queryFn: () => fetchAppointmentsData(user!.id),
    enabled: !!user?.id,
    staleTime: 15 * 1000, // 15s — keep fresh for real-time feel
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const appointments = appointmentsQueryData?.appointments ?? [];
  const payments = appointmentsQueryData?.payments ?? [];
  const pendingBookings = appointmentsQueryData?.pendingBookings ?? [];
  const recentCancellations = appointmentsQueryData?.recentCancellations ?? [];

  // ─── Loyalty via useQuery (Layer 3) ───
  const {
    data: loyaltyQueryData,
    isLoading: loyaltyLoading,
  } = useQuery({
    queryKey: ['cliente', 'loyalty', user?.id, tenantId],
    queryFn: () => fetchLoyaltyData(user!.id, tenantId),
    enabled: !!user?.id && !!tenantId,
    staleTime: 30 * 1000, // 30s — responsive to plan/points changes
    refetchOnWindowFocus: true,
  });

  const points = loyaltyQueryData?.points ?? 0;
  const completedAppointments = loyaltyQueryData?.completedAppointments ?? 0;
  const availableCredits = loyaltyQueryData?.credits ?? 0;
  const activeSubscription = loyaltyQueryData?.activeSubscription ?? null;
  const pendingSubscription = loyaltyQueryData?.pendingSubscription ?? null;
  const expiredSubscription = loyaltyQueryData?.expiredSubscription ?? null;
  const planUsageCount = loyaltyQueryData?.planUsageCount ?? 0;
  const redemptions = loyaltyQueryData?.redemptions ?? 0;
  const pontosNecessarios = loyaltyQueryData?.pontosNecessarios ?? 8;
  const loyaltyEnabled = loyaltyQueryData?.loyaltyEnabled ?? false;

  // ─── Shop via useQuery (Layer 4) ───
  const {
    data: shopQueryData,
    isLoading: shopLoading,
  } = useQuery({
    queryKey: ['cliente', 'shop', tenantId],
    queryFn: () => fetchShopData(tenantId),
    enabled: !!tenantId,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  const { blockedIds: blockedBarberIds } = useBlockedBarbers();
  const shopBarbers = (shopQueryData?.shopBarbers ?? []).filter(b => !blockedBarberIds.includes(b.id));

  // ─── Remaining manual state ───
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [plansSheetOpen, setPlansSheetOpen] = useState(false);
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [renewalDrawerOpen, setRenewalDrawerOpen] = useState(false);
  const [barberProfileOpen, setBarberProfileOpen] = useState<string | null>(null);
  const [reviewModalData, setReviewModalData] = useState<{
    appointmentId: string;
    barberId: string;
    barberName: string;
    barberPhoto: string | null;
  } | null>(null);

  const [pendingDrawerOpen, setPendingDrawerOpen] = useState(false);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);


  // Realtime connection status
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const channelStatusRef = useRef<Record<string, boolean>>({});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelsCreatedAtRef = useRef<number>(Date.now());

  // Derived dataLoaded — true when all layers have loaded at least once
  const dataLoaded = !profileLoading && !appointmentsLoading && !loyaltyLoading && !shopLoading;

  // Plan exhausted detection
  const planExhausted = useMemo(() => {
    if (!activeSubscription) return false;
    const limite = (activeSubscription as any).plano?.limite_agendamentos_mes || 4;
    return planUsageCount >= limite;
  }, [activeSubscription, planUsageCount]);

  // Auto-show renewal drawer when plan is exhausted
  const renewalDrawerShownRef = useRef(false);
  useEffect(() => {
    if (planExhausted && dataLoaded && !renewalDrawerShownRef.current) {
      renewalDrawerShownRef.current = true;
      const timer = setTimeout(() => setRenewalDrawerOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [planExhausted, dataLoaded]);

  // Auto-show pending subscription drawer
  useEffect(() => {
    if (pendingSubscription && dataLoaded) {
      setPendingDrawerOpen(true);
    }
  }, [pendingSubscription, dataLoaded]);

  const handleCancelSubscription = async () => {
    setIsCancelingSubscription(true);
    try {
      const { error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      toast.success("Assinatura cancelada com sucesso");
      setPendingDrawerOpen(false);
      invalidateLoyalty();
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      toast.error("Erro ao cancelar assinatura: " + error.message);
    } finally {
      setIsCancelingSubscription(false);
    }
  };


  // Centralized data error handling
  const { hasError, errors, clearErrors } = useDataError();
  const retryCountRef = useRef(0);

  // ─── Invalidation helpers ───
  const invalidateAppointments = useCallback(() => {
    if (user?.id) queryClient.invalidateQueries({ queryKey: ['cliente', 'appointments', user.id] });
  }, [user?.id, queryClient]);

  const invalidateLoyalty = useCallback(() => {
    if (user?.id) queryClient.invalidateQueries({ queryKey: ['cliente', 'loyalty', user.id, tenantId] });
  }, [user?.id, tenantId, queryClient]);

  const invalidateShop = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cliente', 'shop', tenantId] });
  }, [tenantId, queryClient]);

  // Show non-blocking toast when data errors occur
  const retryAllLayers = useCallback(() => {
    if (!user) return;
    toast.dismiss("data-error-toast");

    clearErrors();
    retryCountRef.current += 1;

    queryClient.invalidateQueries({ queryKey: ['cliente', 'profile', user.id] });
    queryClient.invalidateQueries({ queryKey: ['cliente', 'appointments', user.id] });
    queryClient.invalidateQueries({ queryKey: ['cliente', 'loyalty', user.id, tenantId] });
    queryClient.invalidateQueries({ queryKey: ['cliente', 'shop', tenantId] });
  }, [user, tenantId, queryClient]);

  useEffect(() => {
    if (hasError) {
      console.warn('[DataError] Camadas com erro:', errors.map(e => `${e.camada}: ${e.mensagem}`));
      
      if (retryCountRef.current <= 2) {
        toast.error("Alguns dados podem estar desatualizados. Toque para tentar novamente.", {
          id: "data-error-toast",
          duration: 8000,
          action: {
            label: "Tentar novamente",
            onClick: retryAllLayers,
          },
        });
      }
    } else {
      retryCountRef.current = 0;
    }
  }, [hasError]);

  const reviewTriggeredRef = useRef(false);
  const reviewClosedRef = useRef(false);

  const { pendingReviews, refresh: refreshReviews } = usePendingReviews(user?.id || null);

  useNotificationManager(user?.id || null);
  const { cancelarReserva } = useCancelarReservaPendente();

  const REVIEW_INTERVAL = 1;

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

  const eligibleReviews = useMemo(() => {
    const dismissed = getDismissedIds();
    return pendingReviews.filter((r) => !dismissed.has(r.appointmentId));
  }, [pendingReviews]);

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

  // Helper: update channel status and derive overall connection state
  const updateChannelStatus = useCallback((channelName: string, connected: boolean) => {
    channelStatusRef.current[channelName] = connected;
    const allConnected = Object.values(channelStatusRef.current).every(Boolean);
    setRealtimeConnected(allConnected);
  }, []);

  // Helper: handle channel subscription status with auto-reconnect
  const handleChannelStatus = useCallback((
    channelName: string,
    status: string,
    reconnectFn: () => void
  ) => {
    if (status === 'SUBSCRIBED') {
      updateChannelStatus(channelName, true);
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      const channelAge = Date.now() - channelsCreatedAtRef.current;
      if (channelAge < 5000) {
        console.log(`[REALTIME] Transient error ignored on ${channelName} (${channelAge}ms after creation)`);
        return;
      }
      updateChannelStatus(channelName, false);
      console.log(`[REALTIME] Refetching data immediately after ${channelName} error`);
      invalidateAppointments();
      invalidateLoyalty();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectFn();
      }, 30000);
    }
  }, [updateChannelStatus, invalidateAppointments, invalidateLoyalty]);

  // ─── Canais Realtime unificados ───
  useEffect(() => {
    if (!user) return;

    const userId = user.id;

    channelStatusRef.current = {};

    let channels: ReturnType<typeof supabase.channel>[] = [];

    const initializeChannels = () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      channels = [];
      channelsCreatedAtRef.current = Date.now();

      // ─── Canal 1: Agendamentos + Pending Bookings ───
      const channelAgendamentos = supabase
        .channel('canal-agendamentos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'agendamentos', filter: `user_id=eq.${userId}` },
          (payload) => {
            console.log('Appointment change detected:', payload);
            
            if (payload.eventType === 'INSERT') {
              invalidateAppointments();
              toast.success("Novo agendamento recebido!");
            } else if (payload.eventType === 'DELETE') {
              // Optimistic local removal
              queryClient.setQueryData(['cliente', 'appointments', userId], (old: any) => {
                if (!old) return old;
                return { ...old, appointments: old.appointments.filter((apt: any) => apt.id !== payload.old.id) };
              });
            } else if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              
              if (newData.visivel_para_usuario === false) {
                queryClient.setQueryData(['cliente', 'appointments', userId], (old: any) => {
                  if (!old) return old;
                  return { ...old, appointments: old.appointments.filter((apt: any) => apt.id !== newData.id) };
                });
                return;
              }

              // Optimistic local update
              queryClient.setQueryData(['cliente', 'appointments', userId], (old: any) => {
                if (!old) return old;
                return {
                  ...old,
                  appointments: old.appointments.map((apt: any) =>
                    apt.id === newData.id
                      ? { ...apt, status: newData.status, barbeiro_confirmou: newData.barbeiro_confirmou, cliente_confirmou: newData.cliente_confirmou }
                      : apt
                  ),
                };
              });
              
              // Then refetch for full server data
              invalidateAppointments();
              
              if (newData.status === 'confirmed' && payload.old.status !== 'confirmed') {
                toast.success("✅ Agendamento confirmado pelo barbeiro!");
              } else if (newData.status === 'completed') {
                const completedApt = appointments.find(apt => apt.id === newData.id);
                const serviceName = completedApt?.servico?.nome;
                
                // Optimistic points increment
                queryClient.setQueryData(['cliente', 'loyalty', userId, tenantId], (old: any) => {
                  if (!old) return old;
                  return { ...old, points: (old.points || 0) + 1 };
                });
                
                toast.success(
                  serviceName 
                    ? `🎉 ${serviceName} concluído! +1 ponto adicionado.`
                    : "🎉 Atendimento concluído! +1 ponto adicionado."
                );
                
                if (points + 1 >= pontosNecessarios) {
                  setTimeout(() => {
                    toast.success("🎁 Você ganhou um corte grátis! Resgate no programa de fidelidade.");
                  }, 1000);
                }
                
                invalidateLoyalty();
              } else if (newData.status === 'cancelled_by_admin') {
                toast.error("❌ Agendamento cancelado pela barbearia");
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pending_bookings', filter: `user_id=eq.${userId}` },
          () => invalidateAppointments()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pagamentos', filter: `user_id=eq.${userId}` },
          () => invalidateAppointments()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${userId}` },
          () => {
            // Trigger notification bell refresh via query invalidation
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            const newPref = (payload.new as any)?.barbearia_preferida_id;
            const oldPref = (payload.old as any)?.barbearia_preferida_id;
            // Always refresh profile so header (preferredShop name) updates instantly
            queryClient.invalidateQueries({ queryKey: ['cliente', 'profile', userId] });
            if (newPref !== oldPref) {
              // Tenant changed → refetch shop, loyalty, appointments and assinatura
              invalidateShop();
              invalidateLoyalty();
              invalidateAppointments();
            }
          }
        )
        .subscribe((status) => handleChannelStatus('agendamentos', status, () => {
          initializeChannels();
          queryClient.invalidateQueries({ queryKey: ['cliente', 'profile', userId] });
          invalidateAppointments();
          invalidateLoyalty();
          invalidateShop();
        }));

      // ─── Canal 2: Fidelidade + Assinatura (sync global) ───
      let fidelidadeBuilder = supabase
        .channel('canal-fidelidade')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assinaturas', filter: `user_id=eq.${userId}` }, (payload) => {
          // Sempre revalida loyalty (que recarrega activeSubscription/pending/expired no dashboard)
          invalidateLoyalty();

          const newStatus = (payload.new as any)?.status;
          const oldStatus = (payload.old as any)?.status;
          const eventType = payload.eventType;

          // Toasts contextuais — apenas visuais, sem som
          if (eventType === 'INSERT' && newStatus === 'active') {
            toast.success('Plano carregado 🎉');
          } else if (eventType === 'UPDATE') {
            if (oldStatus === 'pending_renewal' && newStatus === 'active') {
              toast.success('Plano renovado 🎉');
            } else if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
              toast.error('Seu plano foi cancelado');
            } else if (newStatus === 'active' && oldStatus !== 'active') {
              toast.success('Plano ativado 🎉');
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pontos', filter: `user_id=eq.${userId}` }, () => {
          invalidateLoyalty();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resgates', filter: `user_id=eq.${userId}` }, () => {
          invalidateLoyalty();
        });

      if (tenantId) {
        fidelidadeBuilder = fidelidadeBuilder
          .on('postgres_changes', { event: '*', schema: 'public', table: 'promocoes', filter: `tenant_id=eq.${tenantId}` }, () => {
            invalidateLoyalty();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'planos', filter: `tenant_id=eq.${tenantId}` }, () => {
            invalidateLoyalty();
          });
      }

      const channelFidelidade = fidelidadeBuilder
        .subscribe((status) => handleChannelStatus('fidelidade', status, initializeChannels));

      channels = [channelAgendamentos, channelFidelidade];
    };

    initializeChannels();

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [user, profile?.barbearia_preferida_id, handleChannelStatus, invalidateAppointments, invalidateLoyalty]);

  // ─── Refetch ao retornar ao app (visibilitychange) ───
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      // Invalidate stale queries — TanStack Query handles staleness automatically
      invalidateAppointments();
      invalidateLoyalty();
      invalidateShop();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, invalidateAppointments, invalidateLoyalty, invalidateShop]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/auth");
  };

  const handleResumePayment = (bookingId: string) => {
    const booking = pendingBookings.find((b: any) => b.id === bookingId);

    if (booking?.pix_qr_code && booking?.pix_payload && booking?.expires_at) {
      const expiresAt = new Date(booking.expires_at).getTime();
      const now = Date.now();

      if (expiresAt > now) {
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

  const handleCancelPendingBooking = (bookingId: string) => {
    const booking = pendingBookings.find((b: any) => b.id === bookingId);
    cancelarReserva({
      bookingId,
      asaasPaymentId: booking?.asaas_payment_id || null,
    });
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
        invalidateAppointments();
        invalidateLoyalty();
      }
    } else {
      toast.success("✅ Aguardando confirmação do barbeiro");
    }
  };

  return (
    <div className="flex flex-col h-[100dvh]">
      

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
                realtimeConnected={realtimeConnected}
              />
            </div>

            {/* Barbershop Card or Onboarding */}
            {!profileLoading && !!user && profileQueryData !== undefined && (
              preferredShop ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-5 flex items-center gap-2.5 px-1"
                >
                  <Store className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  <p className="text-[12px] text-muted-foreground/60 font-medium truncate flex-1">
                    {preferredShop.nome}
                  </p>
                  <button
                    onClick={() => navigate("/escolher-barbearia?mode=change")}
                    className="text-[10px] text-primary font-semibold flex items-center gap-0.5 active:opacity-70 transition-opacity flex-shrink-0"
                  >
                    Trocar
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Scissors className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        Escolha sua barbearia
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Para agendar, selecione onde você quer se cuidar
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/escolher-barbearia')}
                    className="w-full flex items-center gap-3 rounded-xl bg-primary text-primary-foreground py-3 px-4 mb-2 active:opacity-80 transition-opacity"
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">Usar minha localização</span>
                  </button>

                  <button
                    onClick={() => navigate('/escolher-barbearia?mode=search')}
                    className="w-full flex items-center gap-3 rounded-xl border border-border py-3 px-4 active:opacity-80 transition-opacity"
                  >
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Buscar por nome ou endereço</span>
                  </button>
                </motion.div>
              )
            )}
            
            {/* Plan Tracker ou Loyalty Card */}
            <div className="mb-5">
              {loyaltyLoading ? (
                <div className="rounded-xl h-[140px] bg-muted/10 animate-pulse" />
              ) : activeSubscription ? (
              <PlanTrackerCard
                  planName={(activeSubscription as any).plano?.nome || "Meu Plano"}
                  usedAppointments={planUsageCount}
                  totalAppointments={(activeSubscription as any).plano?.limite_agendamentos_mes || 4}
                  nextBillingDate={activeSubscription.next_billing_date || ""}
                  paymentMethod={activeSubscription.payment_method}
                  onViewDetails={() => setPlansSheetOpen(true)}
                  assinaturaId={activeSubscription.id}
                  planoPreco={(activeSubscription as any).plano?.preco_mensal}
                  servicoNome={(activeSubscription as any).plano?.servico?.nome}
                  diasRestantes={activeSubscription.ciclo_fim ? Math.max(0, Math.ceil((new Date(activeSubscription.ciclo_fim + "T00:00:00").getTime() - Date.now()) / 86400000)) : undefined}
                  userId={user?.id}
                  cashPending={activeSubscription.payment_method === 'cash' && activeSubscription.cash_payment_confirmed === false}
                  onRenovado={() => {
                    invalidateLoyalty();
                    invalidateAppointments();
                  }}
                />
              ) : pendingSubscription ? (
                <div className="space-y-4">
                  {/* "Quadradinho" estratégico que abre a gaveta */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPendingDrawerOpen(true)}
                    className="bg-primary/10 border border-primary/20 rounded-2xl p-4 cursor-pointer relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-1 opacity-20">
                      <Crown className="w-12 h-12 text-primary rotate-12" />
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground">
                          Assinatura em andamento
                        </p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          Toque para finalizar seu plano {(pendingSubscription as any).plano?.nome}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </motion.div>
                  {loyaltyEnabled && (
                    <LoyaltyCard
                      points={points}
                      redemptions={redemptions}
                      pontosNecessarios={pontosNecessarios}
                      onViewDetails={() => setPointsModalOpen(true)}
                    />
                  )}
                </div>
              ) : expiredSubscription ? (
                <div className="space-y-4">
                  <PlanExpiredBanner
                    planName={(expiredSubscription as any).plano?.nome || "Plano"}
                    onRenew={() => navigate("/cliente/assinar")}
                  />
                  {loyaltyEnabled && (
                    <LoyaltyCard
                      points={points}
                      redemptions={redemptions}
                      pontosNecessarios={pontosNecessarios}
                      onViewDetails={() => setPointsModalOpen(true)}
                    />
                  )}
                </div>
              ) : loyaltyEnabled ? (
                <LoyaltyCard
                  points={points}
                  redemptions={redemptions}
                  pontosNecessarios={pontosNecessarios}
                  onViewDetails={() => setPointsModalOpen(true)}
                />
              ) : null}
            </div>

            {/* Schedule Button */}
            <div className="mb-6">
              <ScheduleButton onClick={() => {
                if (!preferredShop) {
                  navigate('/escolher-barbearia');
                  return;
                }
                navigate("/cliente/agendar");
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
                    {pendingBookings.map((booking: any) => (
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

              <p className="text-[8px] font-semibold text-muted-foreground/30 uppercase tracking-[0.2em] mb-2.5">
                Meus Agendamentos
              </p>

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
                      onCancel={() => invalidateAppointments()}
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
        onSubscriptionChanged={() => invalidateLoyalty()}
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
          if (user) queryClient.invalidateQueries({ queryKey: ['cliente', 'profile', user.id] });
        }}
        credits={availableCredits}
        points={points}
        completedAppointments={completedAppointments}
        redemptions={redemptions}
        pontosNecessarios={pontosNecessarios}
      />

      {/* Points Detail Modal */}
      {loyaltyEnabled && (
        <PointsDetailModal
          open={pointsModalOpen}
          onOpenChange={setPointsModalOpen}
          points={points}
          completedAppointments={completedAppointments}
          redemptions={redemptions}
          pontosNecessarios={pontosNecessarios}
        />
      )}

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

      {/* Plan Renewal Drawer */}
      <PlanRenewalDrawer
        open={renewalDrawerOpen}
        onOpenChange={setRenewalDrawerOpen}
        planName={(activeSubscription as any)?.plano?.nome || "Meu Plano"}
        planPrice={(activeSubscription as any)?.plano?.preco_mensal}
        serviceName={(activeSubscription as any)?.plano?.servico?.nome}
      />

      {/* Pending Subscription Drawer */}
      <PendingSubscriptionDrawer
        open={pendingDrawerOpen}
        onOpenChange={setPendingDrawerOpen}
        planName={(pendingSubscription as any)?.plano?.nome || "Plano"}
        onFinalize={() => {
          const ps = pendingSubscription as any;
          // Se for Pix e o QR Code ainda estiver válido
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
          // Se não for Pix ou o Pix expirou, direciona para a página de assinar original para escolher novamente
          navigate("/cliente/assinar", { 
            state: { resumePlanId: ps.plano_id }
          });
        }}
        onCancel={handleCancelSubscription}
        isCanceling={isCancelingSubscription}
      />

      {/* Bottom Navigation */}
      <BottomNavigation
        onProfileClick={() => setProfileSheetOpen(true)}
        onPlansClick={() => setPlansSheetOpen(true)}
        planExhausted={planExhausted}
        hasPendingSubscription={!!pendingSubscription}
      />
    </div>
  );
};

export default Cliente;
