import { useEffect, useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import pixIcon from "@/assets/pix-icon.png";
import logoDub from "@/assets/logo-dub.png";
import scissorsDecor from "@/assets/scissors-decorative.png";
import { BarberCard } from "@/components/booking/BarberCard";
import { useBarberRatings } from "@/hooks/useBarberRatings";
import { PlanCarousel } from "@/components/booking/PlanCarousel";

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  limite_agendamentos_mes: number;
  tenant_id: string | null;
}

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

// ─── Main Page ────────────────────────────────────────────
const ClienteAssinar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const resumePlanId = (location.state as any)?.resumePlanId as string | undefined;

  // Data
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  // Selections
  const [selectedTenantId, setSelectedTenantId] = useState<string | null | "dub">(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"pix" | "card" | "cash" | null>("pix");

  // UI
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);

  const { ratings } = useBarberRatings(barbers.map(b => b.id));

  // ─── Init ─────────────────────────────────
  useEffect(() => {
    loadTenants();
    checkActiveSubscription();
    if (!resumePlanId) {
      autoSelectPreferredShop();
    }
  }, []);

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
      .from('planos').select('*').eq('ativo', true).eq('id', planId).single();
    if (data) {
      const tenantId = data.tenant_id;
      setSelectedTenantId(tenantId || "dub");
      setSelectedPlan(data as Plan);
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
    let query = supabase.from('planos').select('*').eq('ativo', true).order('preco_mensal');
    if (tenantId) { query = query.eq('tenant_id', tenantId); }
    else { query = query.is('tenant_id', null); }
    const { data } = await query;
    setPlans(data || []);
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
        let plansQuery = supabase.from('planos').select('*').eq('ativo', true).order('preco_mensal');
        let barbersQuery = supabase.from('barbeiros').select('id, apelido, foto_url, tenant_id').eq('ativo', true).order('apelido');
        if (tenantId) {
          plansQuery = plansQuery.eq('tenant_id', tenantId);
          barbersQuery = barbersQuery.eq('tenant_id', tenantId);
        } else {
          plansQuery = plansQuery.is('tenant_id', null);
          barbersQuery = barbersQuery.is('tenant_id', null);
        }
        const [{ data: nextPlans }, { data: nextBarbers }] = await Promise.all([plansQuery, barbersQuery]);
        setPlans(nextPlans || []);
        setBarbers(nextBarbers || []);
        setSelectedPlan((prev) => prev ? (nextPlans || []).find((p) => p.id === prev.id) || null : null);
        setSelectedBarber((prev) => prev ? (nextBarbers || []).find((b) => b.id === prev.id) || null : null);
      } catch (error) {
        console.error('Erro ao sincronizar dados:', error);
      }
    };

    const channel = supabase
      .channel(`cliente-assinar-sync-${tenantId ?? 'dub'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planos' }, syncTenantData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barbeiros' }, syncTenantData)
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
          sessionStorage.setItem("subscription_pix_checkout_data", JSON.stringify({
            pixQrCode: data.pixQrCode, pixPayload: data.pixPayload, subscriptionId: data.subscriptionId,
            asaasPaymentId: data.asaasPaymentId, expiresAt: data.expiresAt, value: data.value, planName: data.planName,
          }));
          navigate("/cliente/assinatura-pix");
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

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      
      {/* Header — back arrow + step dots */}
      <div className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={handleBack}
            className="flex items-center justify-center transition-colors active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid #EEE9E0',
              background: 'transparent',
            }}
          >
            <ChevronLeft className="w-4 h-4 text-foreground" strokeWidth={2} />
          </button>

          {step === 2 && plans.length > 1 && (
            <div className="flex items-center gap-1.5">
              {plans.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === currentPlanIndex ? '6px' : '5px',
                    height: i === currentPlanIndex ? '6px' : '5px',
                    background: i === currentPlanIndex ? 'hsl(var(--foreground))' : '#D0CCC4',
                  }}
                />
              ))}
            </div>
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

                <BarbershopCard isDub isSelected={false} onSelect={() => handleSelectShop(null)} disabled={hasActiveSubscription} />

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
                    <BarbershopCard tenant={tenant} isSelected={false} onSelect={() => handleSelectShop(tenant.id)} disabled={hasActiveSubscription} />
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

          {/* ═══ Step 2: Planos — Ultra Premium ═══ */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full flex flex-col"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >

              {hasActiveSubscription && (
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
                <div className="flex-1 flex flex-col min-h-0">
                   <div
                    ref={(el) => {
                      if (!el) return;
                      const handleScroll = () => {
                        const scrollLeft = el.scrollLeft;
                        const width = el.offsetWidth;
                        const newIndex = Math.round(scrollLeft / width);
                        if (newIndex !== currentPlanIndex && newIndex >= 0 && newIndex < plans.length) {
                          setCurrentPlanIndex(newIndex);
                        }
                      };
                      el.onscroll = handleScroll;
                    }}
                    className="flex-1 min-h-0 flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
                  >
                    {plans.map((plan, planIdx) => {
                      const benefits = Array.isArray(plan.beneficios_json) ? plan.beneficios_json : [];
                      const dailyCost = (plan.preco_mensal / 30).toFixed(2).replace('.', ',');
                      const isPopular = planIdx === 0 || plans.length === 1;
                      const priceWhole = Math.floor(plan.preco_mensal);
                      const priceCents = (plan.preco_mensal % 1).toFixed(2).slice(2);

                      return (
                        <div
                          key={plan.id}
                          className="w-full flex-shrink-0 snap-center overflow-y-auto overscroll-y-contain"
                        >
                          <div className="px-6 pt-4 pb-10 max-w-md mx-auto">

                            {/* ── Badge ── */}
                            {isPopular && (
                              <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="mb-6"
                              >
                                <div
                                  className="inline-flex items-center gap-1.5 rounded-md"
                                  style={{
                                    background: 'hsl(var(--primary))',
                                    padding: '4px 10px',
                                  }}
                                >
                                  <span
                                    className="text-primary-foreground"
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: 800,
                                      textTransform: 'uppercase',
                                      letterSpacing: '1.5px',
                                    }}
                                  >
                                    Mais escolhido
                                  </span>
                                </div>
                              </motion.div>
                            )}

                            {/* ── Nome do plano ── */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35 }}
                            >
                              <h2
                                style={{
                                  fontSize: '28px',
                                  fontWeight: 900,
                                  letterSpacing: '-0.5px',
                                  lineHeight: 1.1,
                                  color: 'hsl(var(--foreground))',
                                }}
                              >
                                {plan.nome}
                              </h2>
                            </motion.div>

                            {/* ── Descrição ── */}
                            {plan.descricao && (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.06 }}
                                className="mt-2 line-clamp-2 text-muted-foreground"
                                style={{ fontSize: '13px', lineHeight: 1.5 }}
                              >
                                {plan.descricao}
                              </motion.p>
                            )}

                            {/* ── Preço ── */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1, duration: 0.35 }}
                              className="mt-8"
                            >
                              <div className="flex items-baseline gap-0.5">
                                <span className="text-muted-foreground self-end mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                                  R$
                                </span>
                                <span
                                  className="tabular-nums leading-none text-foreground"
                                  style={{
                                    fontSize: '64px',
                                    fontWeight: 900,
                                    letterSpacing: '-4px',
                                  }}
                                >
                                  {priceWhole}
                                </span>
                                <div className="flex flex-col self-end mb-1.5 ml-0.5">
                                  <span
                                    className="tabular-nums leading-none text-foreground"
                                    style={{ fontSize: '22px', fontWeight: 800 }}
                                  >
                                    ,{priceCents}
                                  </span>
                                  <span className="text-muted-foreground" style={{ fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>
                                    /mês
                                  </span>
                                </div>
                              </div>
                              <p className="mt-2 text-muted-foreground" style={{ fontSize: '11px', fontWeight: 500 }}>
                                <span className="text-primary font-semibold">R$ {dailyCost}/dia</span>
                                <span className="mx-1.5">·</span>
                                Sem fidelidade
                              </p>
                            </motion.div>

                            {/* ── Divider ── */}
                            <div className="my-7 border-t border-border" />

                            {/* ── Benefícios ── */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.16 }}
                            >
                              <p
                                className="mb-5 text-muted-foreground"
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '1.5px',
                                }}
                              >
                                O que está incluso
                              </p>

                              {/* Card principal — agendamentos */}
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center gap-3.5 mb-5 border border-border rounded-xl"
                                style={{ padding: '14px 16px' }}
                              >
                                <div
                                  className="flex items-center justify-center flex-shrink-0 bg-primary"
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '12px',
                                  }}
                                >
                                  <Calendar className="text-primary-foreground" strokeWidth={2} style={{ width: '20px', height: '20px' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-foreground block" style={{ fontSize: '14px', fontWeight: 700 }}>
                                    {plan.limite_agendamentos_mes} agendamento{plan.limite_agendamentos_mes > 1 ? 's' : ''}/mês
                                  </span>
                                  <span className="text-muted-foreground" style={{ fontSize: '11px' }}>
                                    Horário prioritário garantido
                                  </span>
                                </div>
                              </motion.div>

                              {/* Lista de benefícios — numerada */}
                              <div className="space-y-0">
                                {benefits.map((benefit: string, i: number) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.24 + i * 0.03 }}
                                    className="flex items-center gap-3"
                                    style={{
                                      padding: '11px 0',
                                      borderBottom: i < benefits.length - 1 ? '1px solid hsl(var(--border) / 0.5)' : 'none',
                                    }}
                                  >
                                    <div
                                      className="flex items-center justify-center flex-shrink-0"
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '6px',
                                        background: 'hsl(142 76% 45% / 0.1)',
                                      }}
                                    >
                                      <Check className="w-3 h-3 text-success" strokeWidth={3} />
                                    </div>
                                    <span className="text-foreground/80" style={{ fontSize: '13px', fontWeight: 500 }}>
                                      {benefit}
                                    </span>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>

                            {/* ── Barbearia selecionada ── */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.35 }}
                              className="mt-7 flex items-center gap-3 bg-card border border-border rounded-xl"
                              style={{ padding: '12px 14px' }}
                            >
                              <div
                                className="flex items-center justify-center flex-shrink-0 overflow-hidden bg-foreground"
                                style={{ width: '32px', height: '32px', borderRadius: '10px' }}
                              >
                                {selectedTenantId === "dub" ? (
                                  <img src={logoDub} alt="DUB" className="w-5 h-5 object-contain" />
                                ) : (
                                  <Scissors className="w-4 h-4 text-background" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-foreground block truncate" style={{ fontSize: '13px', fontWeight: 600 }}>
                                  {selectedShopName}
                                </span>
                                <span className="text-muted-foreground" style={{ fontSize: '11px' }}>Unidade selecionada</span>
                              </div>
                              <button
                                onClick={handleChangeShop}
                                className="flex-shrink-0 text-primary hover:text-primary/80 transition-colors"
                                style={{ fontSize: '12px', fontWeight: 700 }}
                              >
                                Trocar
                              </button>
                            </motion.div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom CTA */}
                  <div
                    className="flex-shrink-0 border-t border-border bg-background"
                    style={{ padding: '16px 20px max(env(safe-area-inset-bottom), 20px)' }}
                  >
                    <div className="max-w-md mx-auto">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => !hasActiveSubscription && plans[currentPlanIndex] && handleSelectPlan(plans[currentPlanIndex])}
                        disabled={hasActiveSubscription}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 transition-all bg-foreground text-background active:scale-[0.97]",
                          hasActiveSubscription && "opacity-50 cursor-not-allowed"
                        )}
                        style={{
                          borderRadius: '14px',
                          padding: '15px',
                          fontSize: '14px',
                          fontWeight: 700,
                        }}
                      >
                        <span>Assinar este plano</span>
                        <ArrowRight className="w-4 h-4" />
                      </motion.button>

                      <div className="flex items-center justify-center gap-3 mt-3">
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-muted-foreground/40" />
                          <span className="text-muted-foreground/40" style={{ fontSize: '10px', fontWeight: 500 }}>Seguro</span>
                        </div>
                        <div className="w-px h-2.5 bg-border" />
                        <div className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-muted-foreground/40" strokeWidth={2} />
                          <span className="text-muted-foreground/40" style={{ fontSize: '10px', fontWeight: 500 }}>Cancele quando quiser</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                  {([
                    { key: "pix" as const, icon: <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />, title: "Pix", desc: "Confirmação instantânea • Sem taxa", badge: "Recomendado", highlight: true },
                    { key: "card" as const, icon: <CreditCard className="w-5 h-5 text-muted-foreground/50" />, title: "Cartão", desc: "Crédito ou débito • Checkout seguro" },
                    { key: "cash" as const, icon: <Banknote className="w-5 h-5 text-muted-foreground/50" />, title: "Dinheiro", desc: "Pague presencialmente • Barbeiro confirma" },
                  ]).map(method => (
                    <button
                      key={method.key}
                      onClick={() => setSelectedPaymentMethod(method.key)}
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition-all active:scale-[0.99]",
                        selectedPaymentMethod === method.key
                          ? "border-primary/60 bg-primary/5"
                          : "border-border/50 bg-card"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                          method.highlight ? "bg-primary/10" : "bg-muted/30"
                        )}>
                          {method.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-foreground">{method.title}</p>
                            {method.badge && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-px rounded">
                                {method.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{method.desc}</p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          selectedPaymentMethod === method.key ? "bg-primary border-primary" : "border-muted-foreground/30"
                        )}>
                          {selectedPaymentMethod === method.key && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                        </div>
                      </div>
                    </button>
                  ))}
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
        {step === 3 && selectedBarber && !hasActiveSubscription && (
          <motion.div key="bar-step3" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-40">
            <div className="relative px-4 pb-safe">
              <div className="absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div className="relative mx-auto max-w-md rounded-[14px] bg-card/95 backdrop-blur-xl border border-border/30 shadow-lg">
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/20 flex items-center justify-center flex-shrink-0">
                      {selectedBarber.foto_url ? (
                        <img src={selectedBarber.foto_url} alt={selectedBarber.apelido} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60">Barbeiro</div>
                      <div className="text-sm font-semibold text-foreground">{selectedBarber.apelido}</div>
                    </div>
                  </div>
                  <motion.button onClick={handleProceedToPayment} whileTap={{ scale: 0.96 }}
                    className="group flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                    <span>Continuar</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                </div>
              </div>
              <div className="h-3" />
            </div>
          </motion.div>
        )}

        {step === 4 && selectedPaymentMethod && !hasActiveSubscription && (
          <motion.div key="bar-step4" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-40">
            <div className="relative px-4 pb-safe">
              <div className="absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div className="relative mx-auto max-w-md rounded-[14px] bg-card/95 backdrop-blur-xl border border-border/30 shadow-lg">
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                      {selectedPaymentMethod === "pix" ? (
                        <img src={pixIcon} alt="PIX" className="w-3.5 h-3.5" />
                      ) : selectedPaymentMethod === "cash" ? (
                        <Banknote className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60">
                        {selectedPaymentMethod === "pix" ? "Pagar via Pix" : selectedPaymentMethod === "cash" ? "Pagar em Dinheiro" : "Pagar via Cartão"}
                      </div>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/50">R$</span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {selectedPlan?.preco_mensal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <motion.button onClick={handlePayment} disabled={loading} whileTap={{ scale: 0.96 }}
                    className="group flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Assinar</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              <div className="h-3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClienteAssinar;
