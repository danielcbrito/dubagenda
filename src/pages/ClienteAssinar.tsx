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
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import pixIcon from "@/assets/pix-icon.png";
import logoDub from "@/assets/logo-dub.png";
import scissorsDecor from "@/assets/scissors-decorative.png";
import { BarberCard } from "@/components/booking/BarberCard";
import { useBarberRatings } from "@/hooks/useBarberRatings";

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
                <Crown className="w-2.5 h-2.5 inline -mt-px mr-0.5" />
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
      
      {/* Header — back arrow + subtle page dots on step 2 */}
      <div className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors active:scale-95"
          >
            <BackArrow size={22} className="text-foreground" />
          </button>

          {step === 2 && plans.length > 1 && (
            <div className="flex items-center gap-1">
              {plans.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === currentPlanIndex
                      ? "w-1.5 h-1.5 bg-foreground"
                      : "w-1 h-1 bg-muted-foreground/20"
                  )}
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

          {/* ═══ Step 2: Planos — Premium Barbershop Showcase ═══ */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex flex-col">

              {hasActiveSubscription && (
                <div className="flex-shrink-0 mx-4 mb-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-xs text-destructive">Você já possui uma assinatura ativa.</p>
                </div>
              )}

              {plans.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                  <Crown className="w-6 h-6 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum plano disponível</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Esta barbearia ainda não possui planos</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                   {/* Swipeable plan carousel */}
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

                      return (
                        <div
                          key={plan.id}
                          className="w-full flex-shrink-0 snap-center overflow-y-auto overscroll-y-contain"
                        >
                          <div className="px-5 pt-2 pb-8 max-w-md mx-auto flex flex-col justify-between min-h-full">
                            <div>
                              {/* ── Decorative scissors watermark ── */}
                              <div className="relative">
                                <motion.div
                                  initial={{ opacity: 0, rotate: -15 }}
                                  animate={{ opacity: 0.04, rotate: 0 }}
                                  transition={{ duration: 0.8 }}
                                  className="absolute -top-2 -right-2 w-24 h-24 pointer-events-none"
                                >
                                  <img src={scissorsDecor} alt="" className="w-full h-full object-contain opacity-50" />
                                </motion.div>

                                {/* Popular badge */}
                                {isPopular && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4"
                                    style={{
                                      background: "linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.05))",
                                      border: "1px solid hsl(var(--gold) / 0.25)",
                                    }}
                                  >
                                    <Star className="w-3 h-3 text-gold fill-gold" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold">
                                      Mais escolhido
                                    </span>
                                  </motion.div>
                                )}

                                {/* Plan name — editorial serif feel */}
                                <motion.div
                                  key={`name-${plan.id}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.4, ease: "easeOut" }}
                                >
                                  <h2 className="text-2xl font-bold text-foreground tracking-tight leading-tight font-display">
                                    {plan.nome}
                                  </h2>
                                  {/* Gold accent underline */}
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="h-[2px] w-8 rounded-full bg-gold" />
                                    <div className="h-[2px] w-3 rounded-full bg-gold/40" />
                                  </div>
                                </motion.div>

                                {plan.descricao && (
                                  <motion.p
                                    key={`desc-${plan.id}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.08, duration: 0.3 }}
                                    className="text-[13px] text-muted-foreground leading-relaxed mt-3"
                                  >
                                    {plan.descricao}
                                  </motion.p>
                                )}
                              </div>

                              {/* ── Price block — hero pricing ── */}
                              <motion.div
                                key={`price-${plan.id}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.12, duration: 0.4 }}
                                className="mt-7 relative"
                              >
                                {/* Subtle glow behind price */}
                                <div
                                  className="absolute -inset-4 rounded-2xl pointer-events-none"
                                  style={{
                                    background: "radial-gradient(ellipse at center, hsl(var(--gold) / 0.06) 0%, transparent 70%)",
                                  }}
                                />
                                <div className="relative">
                                  <div className="flex items-baseline">
                                    <span className="text-sm text-muted-foreground/60 font-medium mr-1.5">R$</span>
                                    <span className="text-[52px] font-extrabold text-foreground tabular-nums tracking-tighter leading-none">
                                      {Math.floor(plan.preco_mensal)}
                                    </span>
                                    <span className="text-[24px] font-bold text-foreground/70 tabular-nums leading-none ml-0.5">
                                      ,{(plan.preco_mensal % 1).toFixed(2).slice(2)}
                                    </span>
                                    <span className="text-xs text-muted-foreground/40 font-medium ml-2 self-end mb-1.5">/mês</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <Zap className="w-3 h-3 text-gold/60" />
                                    <p className="text-[11px] text-muted-foreground/50">
                                      Apenas R$ {dailyCost}/dia · Cancele quando quiser
                                    </p>
                                  </div>
                                </div>
                              </motion.div>

                              {/* ── Ornamental divider ── */}
                              <div className="flex items-center gap-3 my-6">
                                <div className="flex-1 h-px bg-border/30" />
                                <Scissors className="w-3.5 h-3.5 text-gold/30 rotate-90" />
                                <div className="flex-1 h-px bg-border/30" />
                              </div>

                              {/* ── Benefits list ── */}
                              <motion.div
                                key={`benefits-${plan.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.18, duration: 0.3 }}
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/50 mb-4 flex items-center gap-2">
                                  <Sparkles className="w-3 h-3" />
                                  Benefícios exclusivos
                                </p>

                                <div className="space-y-3.5">
                                  {/* Agendamentos — highlighted */}
                                  <motion.div
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.22 }}
                                    className="flex items-start gap-3 p-3 rounded-xl"
                                    style={{
                                      background: "linear-gradient(135deg, hsl(var(--gold) / 0.08), hsl(var(--gold) / 0.02))",
                                      border: "1px solid hsl(var(--gold) / 0.12)",
                                    }}
                                  >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                      style={{ background: "hsl(var(--gold) / 0.15)" }}>
                                      <Crown className="w-3.5 h-3.5 text-gold" />
                                    </div>
                                    <div>
                                      <span className="text-[13px] text-foreground leading-snug font-semibold">
                                        {plan.limite_agendamentos_mes} agendamento{plan.limite_agendamentos_mes > 1 ? 's' : ''} por mês
                                      </span>
                                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                                        Escolha seu horário preferido com prioridade
                                      </p>
                                    </div>
                                  </motion.div>

                                  {benefits.map((benefit: string, i: number) => (
                                    <motion.div
                                      key={i}
                                      initial={{ opacity: 0, x: -6 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.26 + i * 0.04 }}
                                      className="flex items-start gap-3 pl-1"
                                    >
                                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                        style={{ background: "hsl(var(--primary) / 0.1)" }}>
                                        <Check className="w-3 h-3 text-primary" strokeWidth={2.5} />
                                      </div>
                                      <span className="text-[13px] text-muted-foreground leading-snug">{benefit}</span>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            </div>

                            {/* ── Shop indicator — bottom ── */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.35 }}
                              className="mt-8 flex items-center gap-2.5 py-3 px-3 rounded-xl border border-border/15 bg-secondary/20"
                            >
                              <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {selectedTenantId === "dub" ? (
                                  <img src={logoDub} alt="DUB" className="w-4 h-4 object-contain" />
                                ) : (
                                  <Scissors className="w-3.5 h-3.5 text-muted-foreground/35" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] text-muted-foreground/50 block truncate">{selectedShopName}</span>
                              </div>
                              <button onClick={handleChangeShop} className="text-[11px] text-primary/60 font-medium hover:text-primary transition-colors flex-shrink-0">
                                Trocar
                              </button>
                            </motion.div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fixed bottom area — CTA */}
                  <div className="flex-shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
                    <div className="max-w-md mx-auto space-y-3">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => !hasActiveSubscription && plans[currentPlanIndex] && handleSelectPlan(plans[currentPlanIndex])}
                        disabled={hasActiveSubscription}
                        className={cn(
                          "w-full h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all relative overflow-hidden",
                          "bg-foreground text-background",
                          hasActiveSubscription && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {/* Shine effect */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
                          }}
                        />
                        <span className="relative z-10">Assinar este plano</span>
                        <ArrowRight className="w-4 h-4 relative z-10" />
                      </motion.button>

                      {/* Trust signals */}
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-muted-foreground/30" />
                          <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider font-medium">Seguro</span>
                        </div>
                        <div className="w-px h-2.5 bg-border/20" />
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-muted-foreground/30" />
                          <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider font-medium">Cancele a qualquer hora</span>
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
