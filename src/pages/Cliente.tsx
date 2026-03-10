import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Crown, Banknote, Store, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useDataError } from "@/hooks/useDataError";

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

import { getCache, setCache } from "@/utils/cache";

const Cliente = () => {
  const navigate = useNavigate();

  // Read granular caches (userId unknown yet, try last known)
  const lastUserId = useMemo(() => {
    try { return sessionStorage.getItem("cliente_last_user_id") || null; } catch { return null; }
  }, []);
  const cachedProfile = useMemo(() => lastUserId ? getCache<any>(`cache_profile_${lastUserId}`) : null, [lastUserId]);
  const cachedAppointments = useMemo(() => lastUserId ? getCache<any>(`cache_appointments_${lastUserId}`) : null, [lastUserId]);
  const cachedLoyalty = useMemo(() => lastUserId ? getCache<any>(`cache_loyalty_${lastUserId}`) : null, [lastUserId]);
  const cachedShopTenantId = cachedProfile?.preferredShop?.id || cachedProfile?.profile?.barbearia_preferida_id || null;
  const cachedShop = useMemo(() => {
    const key = cachedShopTenantId ? `cache_shop_${cachedShopTenantId}` : `cache_shop_dub`;
    return getCache<any>(key);
  }, [cachedShopTenantId]);
  const hasCachedData = !!(cachedProfile || cachedAppointments || cachedLoyalty);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(cachedProfile?.profile || null);
  const [appointments, setAppointments] = useState<Appointment[]>(cachedAppointments?.appointments || []);
  const [pendingBookings, setPendingBookings] = useState<any[]>(cachedAppointments?.pendingBookings || []);
  const [points, setPoints] = useState(cachedLoyalty?.points ?? 0);
  const [redemptions, setRedemptions] = useState(cachedLoyalty?.redemptions ?? 0);
  const [pontosNecessarios, setPontosNecessarios] = useState(cachedLoyalty?.pontosNecessarios ?? 8);
  
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [completedAppointments, setCompletedAppointments] = useState(cachedLoyalty?.completedAppointments ?? 0);
  const [plansSheetOpen, setPlansSheetOpen] = useState(false);
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(cachedLoyalty?.availableCredits ?? 0);
  const [payments, setPayments] = useState<any[]>(cachedAppointments?.payments || []);
  const [recentCancellations, setRecentCancellations] = useState<Appointment[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<any>(cachedLoyalty?.activeSubscription || null);
  const [expiredSubscription, setExpiredSubscription] = useState<any>(cachedLoyalty?.expiredSubscription || null);
  const [pendingSubscription, setPendingSubscription] = useState<any>(cachedLoyalty?.pendingSubscription || null);
  const [planUsageCount, setPlanUsageCount] = useState(cachedLoyalty?.planUsageCount ?? 0);
  const [preferredShop, setPreferredShop] = useState<{ id: string; nome: string } | null>(cachedProfile?.preferredShop || null);
  const [shopBarbers, setShopBarbers] = useState<Array<{ id: string; apelido: string; foto_url: string | null; avgRating: number | null; totalReviews: number }>>(cachedShop?.shopBarbers || []);
  const [barberProfileOpen, setBarberProfileOpen] = useState<string | null>(null);
  const [reviewModalData, setReviewModalData] = useState<{
    appointmentId: string;
    barberId: string;
    barberName: string;
    barberPhoto: string | null;
  } | null>(null);

  // Independent loading flags — skip loading if cached data exists
  const [profileLoading, setProfileLoading] = useState(!cachedProfile);
  const [appointmentsLoading, setAppointmentsLoading] = useState(!cachedAppointments);
  const [loyaltyLoading, setLoyaltyLoading] = useState(!cachedLoyalty);
  const [shopLoading, setShopLoading] = useState(!cachedShop && !hasCachedData);

  // Realtime connection status
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const channelStatusRef = useRef<Record<string, boolean>>({});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Race-condition guards for each loader
  const profileLoadRef = useRef(false);
  const appointmentsLoadRef = useRef(false);
  const loyaltyLoadRef = useRef(false);
  const shopLoadRef = useRef(false);

  // Derived dataLoaded — true when all layers have loaded at least once
  const dataLoaded = !profileLoading && !appointmentsLoading && !loyaltyLoading && !shopLoading;

  // Centralized data error handling
  const { hasError, reportError, clearErrors } = useDataError();

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

  // Cache persistence is now handled inside each loader function — no monolithic cache effect needed.

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
      updateChannelStatus(channelName, false);
      // Schedule reconnection after 30s
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectFn();
      }, 30000);
    }
  }, [updateChannelStatus]);

  // ─── Canais Realtime unificados ───
  useEffect(() => {
    if (!user) return;

    const userId = user.id;
    const tenantId = profile?.barbearia_preferida_id || null;

    // Reset status tracking
    channelStatusRef.current = {};

    // Fetch pontos_necessarios initially
    const fetchPontosNecessarios = async () => {
      let query = supabase
        .from("promocoes")
        .select("pontos_necessarios")
        .eq("ativo", true);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data } = await query.limit(1).maybeSingle();
      if (data?.pontos_necessarios && data.pontos_necessarios >= 2) {
        setPontosNecessarios(data.pontos_necessarios);
      }
    };
    fetchPontosNecessarios();

    let channels: ReturnType<typeof supabase.channel>[] = [];

    const initializeChannels = () => {
      // Cleanup existing channels
      channels.forEach(ch => supabase.removeChannel(ch));
      channels = [];

      // ─── Canal 1: Agendamentos + Pending Bookings ───
      const channelAgendamentos = supabase
        .channel('canal-agendamentos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'agendamentos', filter: `user_id=eq.${userId}` },
          (payload) => {
            console.log('Appointment change detected:', payload);
            
            if (payload.eventType === 'INSERT') {
              loadAppointmentsData(userId);
              toast.success("Novo agendamento recebido!");
            } else if (payload.eventType === 'DELETE') {
              setAppointments(prev => prev.filter(apt => apt.id !== payload.old.id));
            } else if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              
              if (newData.visivel_para_usuario === false) {
                setAppointments(prev => prev.filter(apt => apt.id !== newData.id));
                return;
              }
              
              loadAppointmentsData(userId);
              
              if (newData.status === 'confirmed' && payload.old.status !== 'confirmed') {
                toast.success("✅ Agendamento confirmado pelo barbeiro!");
              } else if (newData.status === 'completed') {
                toast.success("🎉 Atendimento concluído!");
                loadLoyaltyData(userId, tenantId);
              } else if (newData.status === 'cancelled_by_admin') {
                toast.error("❌ Agendamento cancelado pela barbearia");
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pending_bookings', filter: `user_id=eq.${userId}` },
          () => loadAppointmentsData(userId)
        )
        .subscribe((status) => handleChannelStatus('agendamentos', status, () => {
          // On reconnect, reload all data
          loadProfileData(userId).then((prof) => {
            const tid = prof?.barbearia_preferida_id || null;
            loadAppointmentsData(userId);
            loadLoyaltyData(userId, tid);
            loadShopData(tid);
          });
          initializeChannels();
        }));

      // ─── Canal 2: Fidelidade ───
      const channelFidelidade = supabase
        .channel('canal-fidelidade')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assinaturas', filter: `user_id=eq.${userId}` }, () => {
          loadLoyaltyData(userId, tenantId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pontos', filter: `user_id=eq.${userId}` }, () => {
          loadLoyaltyData(userId, tenantId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resgates', filter: `user_id=eq.${userId}` }, () => {
          loadLoyaltyData(userId, tenantId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'promocoes' }, () => {
          fetchPontosNecessarios();
          loadLoyaltyData(userId, tenantId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planos' }, () => {
          loadLoyaltyData(userId, tenantId);
        })
        .subscribe((status) => handleChannelStatus('fidelidade', status, initializeChannels));

      // ─── Canal 3: Barbeiros do tenant ───
      const channelBarbeiros = supabase
        .channel('canal-barbeiros')
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'barbeiros',
          ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {})
        }, () => loadShopData(tenantId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => {
          loadShopData(tenantId);
        })
        .subscribe((status) => handleChannelStatus('barbeiros', status, initializeChannels));

      channels = [channelAgendamentos, channelFidelidade, channelBarbeiros];
    };

    initializeChannels();

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [user, profile?.barbearia_preferida_id, handleChannelStatus]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    try { sessionStorage.setItem("cliente_last_user_id", session.user.id); } catch { /* ignore */ }
    // Kick off all loaders in parallel — profile first to get tenantId for dependent loaders
    const profileData = await loadProfileData(session.user.id);
    const tenantId = profileData?.barbearia_preferida_id || null;
    // These three are independent of each other
    loadAppointmentsData(session.user.id);
    loadLoyaltyData(session.user.id, tenantId);
    loadShopData(tenantId);
  };

  // ─── Layer 1: Profile & Tenant ───
  const loadProfileData = async (userId: string) => {
    if (profileLoadRef.current) return null;
    profileLoadRef.current = true;
    setProfileLoading(true);
    try {
      const { data: prof, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      setProfile(prof);

      let shop: { id: string; nome: string } | null = null;
      const tenantId = prof?.barbearia_preferida_id;
      if (tenantId) {
        const { data: tenant } = await supabase.from("tenants").select("id, nome").eq("id", tenantId).single();
        if (tenant) { setPreferredShop(tenant); shop = tenant; }
      } else {
        setPreferredShop(null);
      }

      setCache(`cache_profile_${userId}`, { profile: prof, preferredShop: shop }, 60);
      setProfileLoading(false);
      return prof;
    } catch (err) {
      reportError('profile', err);
      setProfileLoading(false);
      return null;
    } finally {
      profileLoadRef.current = false;
    }
  };

  // ─── Layer 2: Appointments & Pending Bookings ───
  const loadAppointmentsData = async (userId: string) => {
    if (appointmentsLoadRef.current) return;
    appointmentsLoadRef.current = true;
    setAppointmentsLoading(true);
    try {
      const [appointmentsResult, paymentsResult, pendingBookingsResult, cancellationsResult] = await Promise.all([
        supabase.from("agendamentos").select(`
          id, data, hora, status, preco, duracao, observacoes,
          cliente_confirmou, barbeiro_confirmou, ponto_liberado,
          remarcacao_solicitada, motivo_remarcacao, payment_method, tipo_agendamento, is_free,
          servico:servicos(nome),
          barbeiro:barbeiros(apelido),
          pagamentos(metodo, status)
        `)
          .eq("user_id", userId)
          .eq("visivel_para_usuario", true)
          .in("status", ["pending", "confirmed"])
          .order("data", { ascending: true })
          .limit(3),
        supabase.from("pagamentos").select("id, metodo, status, agendamento_id").eq("user_id", userId),
        supabase.from("pending_bookings").select(`
          id, data, hora, servico_id, preco, payment_method, created_at,
          pix_qr_code, pix_payload, asaas_payment_id, expires_at, barbeiro_id,
          servico:servicos(nome)
        `).eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("agendamentos").select("id, data, hora, status, observacoes, cancelado_em, servico:servicos(nome)")
          .eq("user_id", userId)
          .eq("status", "cancelled_by_admin")
          .gte("cancelado_em", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
          .limit(5),
      ]);

      setAppointments(appointmentsResult.data || []);
      setPayments(paymentsResult.data || []);
      setPendingBookings(pendingBookingsResult.data || []);

      const recentlyCancelled = (cancellationsResult.data || []).filter(apt =>
        apt.observacoes?.includes("Cancelado em massa:")
      );
      setRecentCancellations(recentlyCancelled);

      setCache(`cache_appointments_${userId}`, {
        appointments: appointmentsResult.data || [],
        payments: paymentsResult.data || [],
        pendingBookings: pendingBookingsResult.data || [],
      }, 5);
    } catch (err) {
      reportError('appointments', err);
    } finally {
      appointmentsLoadRef.current = false;
      setAppointmentsLoading(false);
    }
  };

  // ─── Layer 3: Loyalty, Credits & Subscriptions ───
  const loadLoyaltyData = async (userId: string, tenantId: string | null) => {
    if (loyaltyLoadRef.current) return;
    loyaltyLoadRef.current = true;
    setLoyaltyLoading(true);
    try {
      const [creditsResult, pontosResult, completedCountResult, activeResgateResult, redemptionsResult] = await Promise.all([
        supabase.rpc('get_user_available_credits', { p_user_id: userId }),
        supabase.from("pontos").select("pontos").eq("user_id", userId).maybeSingle(),
        supabase.from("agendamentos").select("*", { count: 'exact', head: true }).eq("user_id", userId).eq("status", "completed"),
        supabase.from("agendamentos").select("id").eq("user_id", userId).eq("payment_method", "resgate").in("status", ["pending", "confirmed", "completed"]).limit(1),
        supabase.from("resgates").select("id, status").eq("user_id", userId).eq("status", "available"),
      ]);

      setAvailableCredits(creditsResult.data || 0);
      setPoints(pontosResult.data?.pontos || 0);
      setCompletedAppointments(completedCountResult.count || 0);

      let availableRedemptions = 0;
      if (!activeResgateResult.data || activeResgateResult.data.length === 0) {
        availableRedemptions = redemptionsResult.data?.length || 0;
      }
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

      let finalActiveSubscription: any = null;
      let finalExpiredSubscription: any = null;
      let finalPendingSubscription: any = null;
      let finalPlanUsageCount = 0;

      if (activeSub) {
        finalActiveSubscription = activeSub;
        setActiveSubscription(activeSub);
        setExpiredSubscription(null);
        setPendingSubscription(null);

        const { count: usageCount } = await supabase
          .from("plano_agendamentos_usos")
          .select("id", { count: 'exact', head: true })
          .eq("assinatura_id", activeSub.id)
          .is("released_at", null);

        finalPlanUsageCount = usageCount || 0;
        setPlanUsageCount(finalPlanUsageCount);
      } else {
        setActiveSubscription(null);

        const { data: pendingSub } = await supabase
          .from("assinaturas")
          .select("id, status, plano_id, created_at, payment_method, pix_qr_code, pix_payload, asaas_payment_id, pix_expires_at, plano:planos(nome, preco_mensal)")
          .eq("user_id", userId)
          .in("status", ["suspended", "pending_cash"] as any)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        finalPendingSubscription = pendingSub;
        setPendingSubscription(pendingSub);

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

          const isRealExpired = expiredSub?.next_billing_date &&
            new Date(expiredSub.next_billing_date + "T00:00:00") < new Date();

          finalExpiredSubscription = isRealExpired ? expiredSub : null;
          setExpiredSubscription(finalExpiredSubscription);
        } else {
          setExpiredSubscription(null);
        }

        setPlanUsageCount(0);
      }

      setCache(`cache_loyalty_${userId}`, {
        points: pontosResult.data?.pontos || 0,
        completedAppointments: completedCountResult.count || 0,
        availableCredits: creditsResult.data || 0,
        redemptions: availableRedemptions,
        activeSubscription: finalActiveSubscription,
        expiredSubscription: finalExpiredSubscription,
        pendingSubscription: finalPendingSubscription,
        planUsageCount: finalPlanUsageCount,
        pontosNecessarios,
      }, 5);
    } catch (err) {
      reportError('loyalty', err);
    } finally {
      loyaltyLoadRef.current = false;
      setLoyaltyLoading(false);
    }
  };

  // ─── Layer 4: Shop Barbers & Ratings ───
  const loadShopData = async (tenantId: string | null) => {
    if (shopLoadRef.current) return;
    shopLoadRef.current = true;
    setShopLoading(true);
    try {
      let query = supabase
        .from("barbeiros")
        .select("id, apelido, foto_url, barbeiro_avaliacoes(rating)")
        .eq("ativo", true)
        .is("deleted_at", null);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data: barbers, error } = await query;
      if (error) throw error;

      if (barbers) {
        const barbersWithRatings = barbers.map((b: any) => {
          const ratings: number[] = (b.barbeiro_avaliacoes || []).map((r: any) => r.rating);
          const avgRating = ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
            : null;
          return { id: b.id, apelido: b.apelido, foto_url: b.foto_url, avgRating, totalReviews: ratings.length };
        });
        setShopBarbers(barbersWithRatings);

        const cacheKey = tenantId ? `cache_shop_${tenantId}` : `cache_shop_dub`;
        setCache(cacheKey, { shopBarbers: barbersWithRatings }, 30);
      }

      if (!tenantId) {
        setPreferredShop(null);
      }
    } catch (err) {
      console.error('Erro ao carregar barbearia:', err);
    } finally {
      shopLoadRef.current = false;
      setShopLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/auth");
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
        if (user) {
          loadAppointmentsData(user.id);
          loadLoyaltyData(user.id, profile?.barbearia_preferida_id || null);
        }
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
                realtimeConnected={realtimeConnected}
              />
            </div>

            {/* Barbershop Card — minimal inline */}
            {dataLoaded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-5 flex items-center gap-2.5 px-1"
              >
                <Store className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                <p className="text-[12px] text-muted-foreground/60 font-medium truncate flex-1">
                  {preferredShop?.nome || "Barbearia DUB"}
                </p>
                <button
                  onClick={() => navigate("/escolher-barbearia")}
                  className="text-[10px] text-primary font-semibold flex items-center gap-0.5 active:opacity-70 transition-opacity flex-shrink-0"
                >
                  Trocar
                  <ChevronRight className="w-3 h-3" />
                </button>
              </motion.div>
            )}
            
            {/* Plan Tracker ou Loyalty Card */}
            <div className="mb-5">
              {!dataLoaded ? (
                <div className="rounded-xl h-[140px] bg-muted/10 animate-pulse" />
              ) : activeSubscription ? (
              <>
                {/* Banner informativo para assinantes cash que ainda não confirmaram pagamento */}
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
                          Plano ativo — pagamento pendente
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Seus cortes já estão liberados! Pague o valor do plano na barbearia para que o barbeiro confirme o recebimento.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                <PlanTrackerCard
                  planName={(activeSubscription as any).plano?.nome || "Meu Plano"}
                  usedAppointments={planUsageCount}
                  totalAppointments={(activeSubscription as any).plano?.limite_agendamentos_mes || 4}
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
                          <button
                            onClick={() => setPlansSheetOpen(true)}
                            className="text-[11px] text-primary font-semibold mt-2 hover:underline"
                          >
                            Ver detalhes / Cancelar
                          </button>
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
                      onCancel={() => loadAppointmentsData(user.id)}
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
        onSubscriptionChanged={() => user && loadLoyaltyData(user.id, profile?.barbearia_preferida_id || null)}
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
          if (user) loadProfileData(user.id);
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
        onPlansClick={() => setPlansSheetOpen(true)}
      />
    </div>
  );
};

export default Cliente;
