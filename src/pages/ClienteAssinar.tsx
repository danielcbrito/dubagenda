import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sendAssinaturaCashCriadaEvent } from "@/lib/webhookService";
import { Button } from "@/components/ui/button";
import { BackArrow } from "@/components/ui/back-arrow";
import { 
  ArrowRight,
  Banknote,
  Calendar,
  Check, 
  ChevronLeft,
  CreditCard,
  Loader2,
  MapPin,
  Scissors,
  Shield,
  Star,
  User,
  Wallet,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import pixIcon from "@/assets/pix-icon.png";
import logoDub from "@/assets/logo-dub.png";
import scissorsDecor from "@/assets/scissors-decorative.png";
import { BarberCard } from "@/components/booking/BarberCard";
import { useBarberRatings } from "@/hooks/useBarberRatings";
import { PlanCarousel } from "@/components/booking/PlanCarousel";
import { BottomNavigation } from "@/components/BottomNavigation";

import { PaymentOption } from "@/components/booking/PaymentOption";
import { enrichPlansWithAvailability, type PlanWithAvailability } from "@/hooks/usePlansAvailability";
import { getCache, setCache } from "@/utils/cache";

type Plan = PlanWithAvailability;

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
  tenant_id: string | null;
}

interface Tenant {
  id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
  cidade: string | null;
  bairro: string | null;
}

// ─── Barbershop Card ──────────────────────────────────────
function BarbershopCard({
  tenant,
  isDub,
  isSelected,
  onSelect,
  disabled,
}: {
  tenant?: Tenant;
  isDub?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const name = isDub ? "Barbearia DUB" : tenant?.nome || "";
  const subtitle = isDub
    ? "Corte masculino premium • Atendimento exclusivo"
    : tenant?.slogan || [tenant?.bairro, tenant?.cidade].filter(Boolean).join(", ") || "Barbearia parceira";

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-all",
        "active:scale-[0.98]",
        "bg-card backdrop-blur-sm",
        "dark:shadow-none shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isSelected
          ? "border-primary/50 ring-2 ring-primary/20"
          : isDub
            ? "border-primary/25"
            : "border-border/40 hover:border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden",
          isDub ? "bg-muted/40 border border-primary/15" : "bg-muted/50"
        )}>
          {isDub ? (
            <img src={logoDub} alt="DUB" className="w-8 h-8 object-contain" />
          ) : tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <Scissors className="w-5 h-5 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-foreground truncate">{name}</span>
            {isDub && (
              <span className="text-[8px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                <Star className="w-2.5 h-2.5 inline -mt-px mr-0.5" />
                Referência
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{subtitle}</p>
          {!isDub && tenant?.bairro && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground/45 truncate">
                {[tenant.bairro, tenant.cidade].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>
        {isSelected ? (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
          </div>
        ) : (
          <ArrowRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
        )}
      </div>
    </motion.button>
  );
}

// ─── Cache local do contexto de planos ────────────────────
// Guarda a última barbearia/planos/barbeiros vistos para que a tela
// de Planos abra JÁ renderizada (sem spinner) e revalide em background.
const ASSINAR_CTX_KEY = "assinar:ctx";
const ASSINAR_CTX_TTL_MIN = 30;

interface AssinarCtx {
  tenantKey: string;
  plans: Plan[];
  barbers: Barber[];
}

function readAssinarCtx(): AssinarCtx | null {
  const ctx = getCache<AssinarCtx>(ASSINAR_CTX_KEY);
  if (!ctx?.tenantKey || !Array.isArray(ctx.plans) || ctx.plans.length === 0) return null;
  return ctx;
}

// ─── Skeleton do carrossel de planos ──────────────────────
function PlansSkeleton() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 gap-4">
      <div className="w-full max-w-xs h-[22rem] rounded-3xl bg-muted/60 animate-pulse" />
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
const ClienteAssinar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const resumePlanId = (location.state as any)?.resumePlanId as string | undefined;

  // Detect renewal/change mode from URL params
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get("mode"); // "renew" | "change" | null
  const isRenewalMode = mode === "renew";
  const isChangeMode = mode === "change";

  // Fluxo padrão (sem renovar/trocar/retomar) pode abrir direto do cache.
  const canHydrateFromCache = !isRenewalMode && !isChangeMode && !resumePlanId;
  const cachedCtx = useRef<AssinarCtx | null>(canHydrateFromCache ? readAssinarCtx() : null).current;

  // Data
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>(cachedCtx?.plans ?? []);
  const [barbers, setBarbers] = useState<Barber[]>(cachedCtx?.barbers ?? []);

  // Selections
  const [selectedTenantId, setSelectedTenantId] = useState<string | null | "dub">(cachedCtx?.tenantKey ?? null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"pix" | "card" | "cash" | null>("pix");

  // UI
  const [loading, setLoading] = useState(false);
  // Com cache disponível já entramos direto no carrossel de planos (step 2).
  const [step, setStep] = useState(cachedCtx ? 2 : 0);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);

  const { ratings } = useBarberRatings(barbers.map(b => b.id));

  // Woovi: barbeiro tem subconta cadastrada? Se não, só permite pagamento na barbearia.
  const [barberWooviKey, setBarberWooviKey] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedBarber?.id) { setBarberWooviKey(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('barbeiros')
        .select('woovi_pix_key')
        .eq('id', selectedBarber.id)
        .maybeSingle();
      if (!cancelled) setBarberWooviKey((data?.woovi_pix_key as string | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [selectedBarber?.id]);
  const canPayOnline = !!barberWooviKey;

  // Auto-seleciona PIX quando barbeiro aceita pagamento online; senão força "cash".
  useEffect(() => {
    if (canPayOnline) {
      if (selectedPaymentMethod === 'cash') setSelectedPaymentMethod('pix');
    } else if (selectedPaymentMethod === 'pix' || selectedPaymentMethod === 'card') {
      setSelectedPaymentMethod('cash');
    }
  }, [canPayOnline]);

  // ─── Init ─────────────────────────────────
  useEffect(() => {
    loadTenants();
    if (!isRenewalMode && !isChangeMode) {
      checkActiveSubscription();
    }
    if (isRenewalMode) {
      initRenewalMode();
    } else if (isChangeMode) {
      autoSelectPreferredShop();
    } else if (!resumePlanId) {
      autoSelectPreferredShop();
    }
  }, []);

  // Renewal mode: load current plan + barbers, skip to barber selection (step 3)
  const initRenewalMode = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStep(1); return; }

      // Get active subscription with plan details
      const { data: activeSub } = await supabase
        .from("assinaturas")
        .select("*, plano:planos(*)")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeSub?.plano) {
        toast.error("Nenhum plano ativo encontrado");
        navigate("/cliente");
        return;
      }

      const tenantId = activeSub.plano.tenant_id;
      const key = tenantId || "dub";
      setSelectedTenantId(key);
      const [enrichedActive] = await enrichPlansWithAvailability([activeSub.plano]);
      setSelectedPlan(enrichedActive ?? null);
      await loadPlansForTenant(tenantId);
      await loadBarbersForTenant(tenantId);
      setStep(3); // Go straight to barber selection
    } catch (err) {
      console.error("Erro ao iniciar renovação:", err);
      setStep(1);
    }
  };

  const autoSelectPreferredShop = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStep(1); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("barbearia_preferida_id")
        .eq("id", session.user.id)
        .single();

      const preferredId = profile?.barbearia_preferida_id;
      const tenantId = preferredId || null;
      const key = tenantId || "dub";
      setSelectedTenantId(key);
      await loadPlansForTenant(tenantId);
      await loadBarbersForTenant(tenantId);
      setCurrentPlanIndex(0);
      setStep(2);
    } catch (err) {
      console.error("Erro ao carregar barbearia preferida:", err);
      setStep(1);
    }
  };

  useEffect(() => {
    if (resumePlanId && step === 0) {
      loadAllPlansForResume(resumePlanId);
    }
  }, [resumePlanId]);

  const loadAllPlansForResume = async (planId: string) => {
    const { data } = await supabase
      .from('planos').select('*').eq('id', planId).single();
    if (data) {
      const tenantId = data.tenant_id;
      setSelectedTenantId(tenantId || "dub");
      const [enriched] = await enrichPlansWithAvailability([data]);
      setSelectedPlan(enriched ?? null);
      await loadPlansForTenant(tenantId);
      await loadBarbersForTenant(tenantId);
      setStep(3);
    } else {
      setStep(1);
    }
  };

  const checkActiveSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('assinaturas').select('*').eq('user_id', session.user.id).eq('status', 'active').maybeSingle();
    setHasActiveSubscription(!!data);
  };

  const loadTenants = async () => {
    const { data } = await supabase
      .from("tenants").select("id, nome, slogan, logo_url, cidade, bairro")
      .eq("ativo", true).eq("onboarding_completed", true).order("nome");
    setTenants(data || []);
  };

  const loadPlansForTenant = async (tenantId: string | null) => {
    // Inclui planos inativos — UI exibe como "Indisponível" (opacity-30)
    let query = supabase.from('planos').select('*').order('preco_mensal');
    if (tenantId) { query = query.eq('tenant_id', tenantId); }
    else { query = query.is('tenant_id', null); }
    const { data } = await query;
    const enriched = await enrichPlansWithAvailability(data || []);
    setPlans(enriched);
  };

  const loadBarbersForTenant = async (tenantId: string | null) => {
    let query = supabase.from('barbeiros').select('id, apelido, foto_url, tenant_id').eq('ativo', true).order('apelido');
    if (tenantId) { query = query.eq('tenant_id', tenantId); }
    else { query = query.is('tenant_id', null); }
    const { data } = await query;
    setBarbers(data || []);
  };

  useEffect(() => {
    if (selectedTenantId === null) return;
    const tenantId = selectedTenantId === "dub" ? null : selectedTenantId;

    const syncTenantData = async () => {
      try {
        let plansQuery = supabase.from('planos').select('*').order('ativo', { ascending: false }).order('preco_mensal');
        let barbersQuery = supabase.from('barbeiros').select('id, apelido, foto_url, tenant_id').eq('ativo', true).order('apelido');
        if (tenantId) {
          plansQuery = plansQuery.eq('tenant_id', tenantId);
          barbersQuery = barbersQuery.eq('tenant_id', tenantId);
        } else {
          plansQuery = plansQuery.is('tenant_id', null);
          barbersQuery = barbersQuery.is('tenant_id', null);
        }
        const [{ data: nextPlans }, { data: nextBarbers }] = await Promise.all([plansQuery, barbersQuery]);
        const enriched = await enrichPlansWithAvailability(nextPlans || []);
        setPlans(enriched);
        setBarbers(nextBarbers || []);
        setSelectedPlan((prev) => prev ? enriched.find((p) => p.id === prev.id) || null : null);
        setSelectedBarber((prev) => prev ? (nextBarbers || []).find((b) => b.id === prev.id) || null : null);
      } catch (error) {
        console.error('Erro ao sincronizar dados:', error);
      }
    };

    const channel = supabase
      .channel(`cliente-assinar-sync-${tenantId ?? 'dub'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planos' }, syncTenantData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barbeiros' }, syncTenantData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assinaturas' }, syncTenantData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plano_servicos' }, syncTenantData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTenantId]);

  // ─── Handlers ─────────────────────────────
  const handleSelectShop = async (tenantId: string | null) => {
    const key = tenantId || "dub";
    setSelectedTenantId(key);
    setSelectedPlan(null);
    setSelectedBarber(null);
    await loadPlansForTenant(tenantId);
    await loadBarbersForTenant(tenantId);
    setCurrentPlanIndex(0);
    setStep(2);
  };

  const handleChangeShop = () => {
    setSelectedTenantId(null);
    setSelectedPlan(null);
    setSelectedBarber(null);
    setPlans([]);
    setBarbers([]);
    setStep(1);
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep(3);
  };

  const handleProceedToPayment = () => {
    if (!selectedBarber) { toast.error("Selecione um barbeiro"); return; }
    setStep(4);
  };

  const handlePayment = async () => {
    if (!selectedPlan || !selectedPaymentMethod || !selectedBarber) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Você precisa estar logado"); navigate("/auth"); return; }

      // In renewal/change mode, remove the old active subscription before creating new one
      if (isRenewalMode || isChangeMode) {
        await supabase.from('assinaturas').delete().eq('user_id', session.user.id).eq('status', 'active');
      }

      if (selectedPaymentMethod === "cash") {
        await supabase.from('assinaturas').delete().eq('user_id', session.user.id).in('status', ['suspended', 'pending_cash']);
        await supabase.from('assinaturas').delete().eq('user_id', session.user.id).eq('status', 'active').eq('cash_payment_confirmed', false);
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        const nextBillingStr = `${nextBilling.getFullYear()}-${String(nextBilling.getMonth() + 1).padStart(2, '0')}-${String(nextBilling.getDate()).padStart(2, '0')}`;
        const { error: insertError } = await supabase.from('assinaturas').insert({
          user_id: session.user.id, plano_id: selectedPlan.id, barbeiro_id: selectedBarber.id,
          status: 'active' as any, payment_method: 'cash' as any, cash_payment_confirmed: false, next_billing_date: nextBillingStr,
        });
        if (insertError) throw insertError;
        // Enviar notificação de assinatura cash (não bloqueia o fluxo)
        sendAssinaturaCashCriadaEvent({
          cliente_id: session.user.id,
          plano_nome: selectedPlan.nome,
          plano_preco: selectedPlan.preco_mensal,
          barbeiro_id: selectedBarber.id,
        }).catch(() => {});
        toast.success("Plano ativado! Agende seu primeiro corte.");
        navigate(`/cliente/agendar?barber=${selectedBarber.id}`);
      } else if (selectedPaymentMethod === "card") {
        const { data, error } = await supabase.functions.invoke('create-subscription-card', {
          body: { planoId: selectedPlan.id, barbeiroId: selectedBarber.id }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.url) {
          sessionStorage.setItem("subscription_barber_id", selectedBarber.id);
          window.location.href = data.url;
        }
      } else {
        const { data, error } = await supabase.functions.invoke('create-subscription-pix', {
          body: { planoId: selectedPlan.id, barbeiroId: selectedBarber.id }
        });
        if (error) throw error;
        if (data?.success) {
          sessionStorage.setItem("subscription_barber_id", selectedBarber.id);
          sessionStorage.setItem("pix_checkout_data", JSON.stringify({
            pixQrCode: data.pixQrCode,
            pixPayload: data.pixPayload,
            pendingBookingId: data.subscriptionId,
            asaasPaymentId: data.asaasPaymentId,
            expiresAt: data.expiresAt,
            value: data.value,
            serviceFee: data.serviceFee ?? 0.9,
            serviceName: data.planName,
            barberName: selectedBarber.apelido,
            provider: 'woovi',
            correlationId: data.asaasPaymentId,
          }));
          navigate("/cliente/pix-checkout");
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 4) { setStep(3); setSelectedPaymentMethod("pix"); }
    else if (step === 3) { setStep(2); setSelectedBarber(null); }
    else if (step === 2) { navigate("/cliente"); }
    else { navigate("/cliente"); }
  };

  const selectedShopName = selectedTenantId === "dub"
    ? "Barbearia DUB"
    : tenants.find(t => t.id === selectedTenantId)?.nome || "";

  const headerTitle = step === 0
    ? "Carregando..."
    : step === 1
      ? "Escolha a barbearia"
      : step === 2
        ? "Nossos Planos"
        : step === 3
          ? "Escolha seu barbeiro"
          : "Forma de pagamento";

  // Na etapa de Planos a barra de navegação global fica visível,
  // então o conteúdo é encurtado e a seta de voltar é ocultada.
  const showBottomNav = step === 2;

  return (
    <div
      className="fixed inset-0 flex flex-col bg-background"
      style={
        showBottomNav
          ? { paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }
          : undefined
      }
    >

      {/* Header — back arrow + step dots */}
      <div className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {!showBottomNav && (
            <button
              onClick={handleBack}
              className="flex items-center justify-center active:scale-95 transition-transform"
            >
              <BackArrow size={24} className="text-foreground" />
            </button>
          )}

          {/* Title for non-carousel steps */}
          {step !== 2 && (
            <span className="text-sm font-semibold text-foreground">{headerTitle}</span>
          )}
        </div>
      </div>


      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* Loading */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}

          {/* ═══ Step 1: Barbearia ═══ */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              className="h-full overflow-y-auto overscroll-contain px-4 pb-20">
              <div className="max-w-2xl mx-auto space-y-2.5">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Sua Barbearia</h2>
                  <p className="text-sm text-muted-foreground mt-1">Selecione onde deseja assinar o plano</p>
                </div>

                <BarbershopCard isDub isSelected={false} onSelect={() => handleSelectShop(null)} disabled={hasActiveSubscription && !isChangeMode} />

                {tenants.length > 0 && (
                  <div className="flex items-center gap-3 py-1.5 px-1">
                    <div className="flex-1 h-px bg-border/30" />
                    <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/35 font-semibold">
                      Barbearias parceiras
                    </span>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                )}

                {tenants.map((tenant, index) => (
                  <motion.div key={tenant.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * 0.03 }}>
                    <BarbershopCard tenant={tenant} isSelected={false} onSelect={() => handleSelectShop(tenant.id)} disabled={hasActiveSubscription && !isChangeMode} />
                  </motion.div>
                ))}

                {tenants.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Scissors className="w-5 h-5 text-muted-foreground/30 mb-2" />
                    <p className="text-[11px] text-muted-foreground/50">Nenhuma outra barbearia parceira disponível</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 2: Planos — Carousel ═══ */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              {hasActiveSubscription && !isRenewalMode && !isChangeMode && (
                <div className="flex-shrink-0 mx-4 mb-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-xs text-destructive">Você já possui uma assinatura ativa.</p>
                </div>
              )}

              {plans.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                  <Scissors className="w-6 h-6 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum plano disponível</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Esta barbearia ainda não possui planos</p>
                </div>
              ) : (
                <PlanCarousel
                  plans={plans}
                  currentPlanIndex={currentPlanIndex}
                  setCurrentPlanIndex={setCurrentPlanIndex}
                  onSelectPlan={handleSelectPlan}
                  hasActiveSubscription={hasActiveSubscription && !isRenewalMode && !isChangeMode}
                  selectedTenantId={selectedTenantId}
                  selectedShopName={selectedShopName}
                  onChangeShop={handleChangeShop}
                />
              )}
            </motion.div>
          )}


          {/* ═══ Step 3: Barbeiro ═══ */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              className="h-full overflow-y-auto overscroll-contain px-4 pb-28">
              <div className="max-w-2xl mx-auto">
                <div className="mb-5 pt-1">
                  <h2 className="text-xl font-semibold text-foreground">Seu Barbeiro</h2>
                  <p className="text-sm text-muted-foreground mt-1">Escolha o profissional exclusivo do seu plano</p>
                </div>

                {barbers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14">
                    <User className="w-6 h-6 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhum barbeiro disponível</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {barbers.map((barber, index) => (
                      <motion.div key={barber.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                        <BarberCard barber={barber} isSelected={selectedBarber?.id === barber.id} onSelect={() => setSelectedBarber(barber)} rating={ratings[barber.id]} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 4: Pagamento ═══ */}
          {step === 4 && selectedPlan && (
            <motion.div key="step4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              className="h-full overflow-y-auto overscroll-contain px-4 pb-28">
              <div className="max-w-2xl mx-auto">
                <div className="mb-6 pt-1">
                  <h2 className="text-xl font-semibold text-foreground">Pagamento</h2>
                  <p className="text-sm text-muted-foreground mt-1">Escolha como deseja pagar</p>
                </div>

                {/* Summary */}
                <div className="bg-card border border-border/40 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{selectedPlan.nome}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{selectedShopName} • Renovação automática</p>
                    </div>
                    <p className="text-base font-bold text-foreground tabular-nums">
                      R$ {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  {selectedBarber && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-muted/20 flex items-center justify-center flex-shrink-0">
                        {selectedBarber.foto_url ? (
                          <img src={selectedBarber.foto_url} alt={selectedBarber.apelido} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-muted-foreground/40" />
                        )}
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        Barbeiro: <span className="font-medium text-foreground">{selectedBarber.apelido}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment methods */}
                <div className="space-y-3 mb-4">
                  {canPayOnline && (
                    <>
                      <PaymentOption
                        value="pix"
                        selected={selectedPaymentMethod === "pix"}
                        onSelect={() => setSelectedPaymentMethod("pix")}
                        title="Pix"
                        description="Confirmação instantânea • Sem taxa"
                        highlight={true}
                        icon={<img src={pixIcon} alt="PIX" className={cn("w-5 h-5 object-contain", selectedPaymentMethod === "pix" ? "" : "grayscale opacity-50")} />}
                      />

                      <PaymentOption
                        value="card"
                        selected={selectedPaymentMethod === "card"}
                        onSelect={() => setSelectedPaymentMethod("card")}
                        title="Cartão"
                        description="Crédito ou débito • Checkout seguro"
                        icon={<CreditCard className={cn("w-5 h-5", selectedPaymentMethod === "card" ? "text-primary" : "text-muted-foreground/40")} />}
                      />
                    </>
                  )}

                  <PaymentOption
                    value="cash"
                    selected={selectedPaymentMethod === "cash"}
                    onSelect={() => setSelectedPaymentMethod("cash")}
                    title="Dinheiro"
                    description={canPayOnline ? "Pague presencialmente • Barbeiro confirma" : "Este barbeiro só aceita pagamento na barbearia"}
                    icon={<Banknote className={cn("w-5 h-5", selectedPaymentMethod === "cash" ? "text-primary" : "text-muted-foreground/40")} />}
                  />
                </div>

                <div className="flex items-center justify-center gap-1.5 mt-6">
                  <Shield className="w-3 h-3 text-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">
                    Pagamento Criptografado
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Floating Bottom Bars (Steps 3 & 4) ═══ */}
      <AnimatePresence>
        {step === 3 && selectedBarber && (!hasActiveSubscription || isRenewalMode || isChangeMode) && (
          <motion.div
            key="bar-step3"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40"
          >
            {/* Subtle top fade */}
            <div 
              className="h-16 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
            />

            {/* Bar content */}
            <div className="bg-background border-t border-border/40 px-5 pb-safe">
              <div className="pt-3.5 pb-4 space-y-3">
                {/* Info row */}
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2.5">
                    {selectedBarber?.foto_url ? (
                      <img src={selectedBarber.foto_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-[11px] font-bold text-primary">
                        {selectedBarber?.apelido?.charAt(0)}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground/60 leading-none mb-0.5">
                        {selectedPlan?.nome}
                      </span>
                      <span className="text-[13px] font-semibold text-foreground leading-none">
                        {selectedBarber?.apelido}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] text-muted-foreground/50 font-medium">R$</span>
                    <span className="text-[17px] font-bold text-foreground tabular-nums tracking-tight">
                      {selectedPlan?.preco_mensal.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                {/* Full-width CTA */}
                <motion.button
                  onClick={handleProceedToPayment}
                  whileTap={{ scale: 0.985 }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2",
                    "h-[50px] rounded-xl",
                    "font-semibold text-[14px] text-primary-foreground",
                    "bg-primary",
                    "active:brightness-90 transition-all duration-150"
                  )}
                  style={{
                    boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)"
                  }}
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && selectedPaymentMethod && (!hasActiveSubscription || isRenewalMode || isChangeMode) && (
          <motion.div
            key="bar-step4"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40"
          >
            {/* Subtle top fade */}
            <div 
              className="h-16 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
            />

            {/* Bar content */}
            <div className="bg-background border-t border-border/40 px-5 pb-safe">
              <div className="pt-3.5 pb-4 space-y-3">
                {/* Info row */}
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2.5">
                    {selectedBarber?.foto_url ? (
                      <img src={selectedBarber.foto_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-[11px] font-bold text-primary">
                        {selectedBarber?.apelido?.charAt(0)}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground/60 leading-none mb-0.5">
                        {selectedPlan?.nome}
                      </span>
                      <span className="text-[13px] font-semibold text-foreground leading-none">
                        {selectedBarber?.apelido}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {(selectedPaymentMethod === 'pix' || selectedPaymentMethod === 'card') && (
                      <span className="text-[9px] text-muted-foreground/60 leading-none mb-1">
                        + R$ 0,90 taxa de serviço
                      </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-muted-foreground/50 font-medium">R$</span>
                      <span className="text-[17px] font-bold text-foreground tabular-nums tracking-tight">
                        {((selectedPlan?.preco_mensal ?? 0) + ((selectedPaymentMethod === 'pix' || selectedPaymentMethod === 'card') ? 0.9 : 0)).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Full-width CTA */}
                <motion.button
                  onClick={handlePayment}
                  disabled={loading}
                  whileTap={{ scale: loading ? 1 : 0.985 }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2",
                    "h-[50px] rounded-xl",
                    "font-semibold text-[14px] text-primary-foreground",
                    "bg-primary",
                    "active:brightness-90 transition-all duration-150",
                    loading && "opacity-70 cursor-wait"
                  )}
                  style={{
                    boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)"
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {selectedPaymentMethod === 'pix' ? 'Gerar PIX' :
                         selectedPaymentMethod === 'card' ? 'Pagar' :
                         'Assinar'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showBottomNav && <BottomNavigation />}
    </div>
  );
};

export default ClienteAssinar;
