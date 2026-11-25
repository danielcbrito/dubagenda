import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sendAssinaturaCashCriadaEvent } from "@/lib/webhookService";
import { BackArrow } from "@/components/ui/back-arrow";
import { 
  ArrowRight,
  Check, 
  ChevronRight,
  Loader2,
  MapPin,
  Scissors,
  Star,
  User,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import pixIcon from "@/assets/pix-icon.png";
import logoDub from "@/assets/logo-dub.png";
import { BarberCard } from "@/components/booking/BarberCard";
import { useBarberRatings } from "@/hooks/useBarberRatings";
import { useBarberPaymentOptions } from "@/hooks/useBarberPaymentOptions";
import { resolveBookingPaymentMethod } from "@/lib/barber-payment-options";
import { getServiceFee } from "@/lib/payment-fees";
import { formatCPF, validateCPF } from "@/lib/validators";
import { StepDots } from "@/components/booking/StepDots";
import { FloatingActionBar } from "@/components/booking/FloatingActionBar";
import { PlanCarousel } from "@/components/booking/PlanCarousel";
import { BottomNavigation } from "@/components/BottomNavigation";

import { PaymentOption } from "@/components/booking/PaymentOption";
import { enrichPlansWithAvailability, type PlanWithAvailability } from "@/hooks/usePlansAvailability";
import { MeuPlanoView, type MeuPlanoSub } from "@/components/plano/MeuPlanoView";

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

  // Data
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  // Selections
  const [selectedTenantId, setSelectedTenantId] = useState<string | null | "dub">(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"pix" | "cash" | null>("pix");

  // CPF (obrigatório para emissão do PIX, idêntico ao fluxo de agendamento)
  const [profileCpf, setProfileCpf] = useState<string | null>(null);
  const [cpfInput, setCpfInput] = useState("");
  const [cpfError, setCpfError] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [visitedStep1, setVisitedStep1] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [mySub, setMySub] = useState<MeuPlanoSub | null>(null);
  const [showMyPlan, setShowMyPlan] = useState(false);
  const [checkingMyPlan, setCheckingMyPlan] = useState(true);

  const { ratings } = useBarberRatings(barbers.map(b => b.id));

  // Opções de pagamento habilitadas pelo barbeiro/unidade (idêntico ao agendamento)
  const effectivePaymentTenantId = selectedBarber?.tenant_id ?? (selectedTenantId && selectedTenantId !== "dub" ? selectedTenantId : null);
  const {
    pixHabilitado,
    barbeariaHabilitado,
    loading: barberPaymentOptsLoading,
    error: barberPaymentOptsError,
  } = useBarberPaymentOptions(selectedBarber?.id || null, effectivePaymentTenantId);

  // Woovi: barbeiro tem subconta cadastrada? Se não, só permite pagamento na barbearia.
  const [barberWooviKey, setBarberWooviKey] = useState<string | null>(null);
  const [barberWooviLoading, setBarberWooviLoading] = useState(false);
  useEffect(() => {
    if (!selectedBarber?.id) {
      setBarberWooviKey(null);
      setBarberWooviLoading(false);
      return;
    }
    let cancelled = false;
    setBarberWooviLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('barbeiros')
          .select('woovi_pix_key')
          .eq('id', selectedBarber.id)
          .maybeSingle();
        if (!cancelled) setBarberWooviKey((data?.woovi_pix_key as string | null) ?? null);
      } finally {
        if (!cancelled) setBarberWooviLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBarber?.id]);

  const isPaymentConfigLoading = barberWooviLoading || (!!effectivePaymentTenantId && barberPaymentOptsLoading);
  const pixAvailable = !!barberWooviKey && (!effectivePaymentTenantId || (!barberPaymentOptsError && pixHabilitado));
  const cashAvailable = !effectivePaymentTenantId || (!barberPaymentOptsError && barbeariaHabilitado);

  // Preserva a escolha válida e desabilita Cartão (card: false)
  useEffect(() => {
    if (isPaymentConfigLoading) return;
    const resolved = resolveBookingPaymentMethod(selectedPaymentMethod, {
      pix: pixAvailable,
      cash: cashAvailable,
      wallet: false,
      card: false,
    });
    setSelectedPaymentMethod(resolved === 'pix' || resolved === 'cash' ? resolved : null);
  }, [isPaymentConfigLoading, pixAvailable, cashAvailable]);

  // ─── Init ─────────────────────────────────
  const loadProfileCpf = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("cpf")
        .eq("id", session.user.id)
        .maybeSingle();
      const savedCpf = ((profile as any)?.cpf || "").replace(/\D/g, "");
      if (savedCpf) {
        setProfileCpf(savedCpf);
        setCpfInput(formatCPF(savedCpf));
      } else {
        setProfileCpf(null);
      }
    } catch (err) {
      console.error("Erro ao carregar CPF do perfil:", err);
    }
  };

  const loadMySub = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCheckingMyPlan(false); return; }
    const { data } = await supabase
      .from("assinaturas")
      .select("id, status, next_billing_date, ciclo_fim, usos_ciclo_atual, user_id, plano:planos(nome, preco_mensal, limite_agendamentos_mes, servico:servicos!planos_servico_id_fkey(nome))")
      .eq("user_id", session.user.id)
      .in("status", ["active", "past_due", "pending_renewal", "suspended"] as any)
      .order("next_billing_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data?.plano) { setMySub(data as any); setShowMyPlan(true); }
    setCheckingMyPlan(false);
  };

  useEffect(() => {
    loadProfileCpf();
    if (!isRenewalMode && !isChangeMode && !resumePlanId) loadMySub();
    else setCheckingMyPlan(false);
    loadTenants();
    if (!isRenewalMode && !isChangeMode) {
      checkActiveSubscription();
    }
    if (isRenewalMode) {
      initRenewalMode();
    } else if (isChangeMode) {
      initChangeMode();
    } else if (!resumePlanId) {
      autoSelectPreferredShop();
    }
  }, []);

  // Change mode: load all plans of the current/expired subscription's barbershop (step 2)
  const initChangeMode = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStep(1); return; }

      const [{ data: sub }, { data: profile }] = await Promise.all([
        supabase
          .from("assinaturas")
          .select("plano:planos(tenant_id)")
          .eq("user_id", session.user.id)
          .in("status", ["active", "cancelled", "past_due", "suspended", "pending_renewal", "pending_cash"] as any)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("barbearia_preferida_id")
          .eq("id", session.user.id)
          .maybeSingle(),
      ]);

      const rawPlano = Array.isArray(sub?.plano) ? sub?.plano[0] : sub?.plano;
      const tenantId = rawPlano
        ? (rawPlano.tenant_id ?? null)
        : (profile?.barbearia_preferida_id ?? null);

      setSelectedTenantId(tenantId || "dub");
      await loadPlansForTenant(tenantId);
      await loadBarbersForTenant(tenantId);
      setCurrentPlanIndex(0);
      setStep(2);
    } catch (err) {
      console.error("Erro ao carregar planos da barbearia:", err);
      await autoSelectPreferredShop();
    }
  };

  // Renewal mode: load current plan + barbers, skip to barber selection (step 3)
  const initRenewalMode = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStep(1); return; }

      // Carrega a assinatura mais recente do cliente, incluindo planos expirados/cancelados,
      // para permitir a renovação (escolha de barbeiro → pagamento → renovado).
      const { data: sub } = await supabase
        .from("assinaturas")
        .select("*, plano:planos(*)")
        .eq("user_id", session.user.id)
        .in("status", ["active", "cancelled", "past_due", "suspended", "pending_renewal", "pending_cash"] as any)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const rawPlano = Array.isArray(sub?.plano) ? sub?.plano[0] : sub?.plano;

      if (!rawPlano) {
        // Fallback: se não achar pelo status, tenta carregar qualquer plano ativo da barbearia
        toast.error("Nenhum plano encontrado para renovar");
        navigate("/cliente");
        return;
      }

      const tenantId = rawPlano.tenant_id;
      const key = tenantId || "dub";
      setSelectedTenantId(key);
      const [enrichedActive] = await enrichPlansWithAvailability([rawPlano]);
      setSelectedPlan(enrichedActive ?? rawPlano);
      await loadPlansForTenant(tenantId);
      await loadBarbersForTenant(tenantId);
      // Nenhum barbeiro é pré-selecionado: o cliente escolhe livremente tocando em um.
      setStep(3); // Vá direto para a escolha do barbeiro
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
    return data || [];
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
        setSelectedPlan((prev) => prev ? enriched.find((p) => p.id === prev.id) || prev : null);
        setSelectedBarber((prev) => prev ? (nextBarbers || []).find((b) => b.id === prev.id) || prev : null);
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

  // Recuperação de segurança para evitar tela branca no step 4
  useEffect(() => {
    if (step === 4 && !selectedPlan && plans.length > 0) {
      setSelectedPlan(plans[0]);
    }
  }, [step, selectedPlan, plans]);

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
    setVisitedStep1(true);
    setStep(1);
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep(3);
  };

  const handleProceedFromPayment = async () => {
    if (!selectedPlan || !selectedPaymentMethod || !selectedBarber) return;

    if (selectedPaymentMethod === "pix") {
      const digits = (cpfInput || "").replace(/\D/g, "");
      if (digits.length !== 11 || !validateCPF(digits)) {
        setCpfError(true);
        toast.error("Informe um CPF válido para gerar o PIX.");
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && digits !== profileCpf) {
          await supabase.from("profiles").update({ cpf: digits }).eq("id", user.id);
          setProfileCpf(digits);
        }
      } catch (err) {
        console.error("Erro ao salvar CPF:", err);
      }
    }

    await handlePayment();
  };

  const handlePayment = async () => {
    if (!selectedPlan || !selectedPaymentMethod || !selectedBarber) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Você precisa estar logado"); navigate("/auth"); return; }

      // Renovação/troca: a assinatura antiga NUNCA é apagada antes do novo plano
      // ser criado com sucesso — evita o cliente ficar sem plano se algo falhar.
      const isReplacing = isRenewalMode || isChangeMode;

      if (selectedPaymentMethod === "cash") {
        await supabase.from('assinaturas').delete().eq('user_id', session.user.id).in('status', ['suspended', 'pending_cash']);
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        const nextBillingStr = `${nextBilling.getFullYear()}-${String(nextBilling.getMonth() + 1).padStart(2, '0')}-${String(nextBilling.getDate()).padStart(2, '0')}`;
        const { data: newSub, error: insertError } = await supabase.from('assinaturas').insert({
          user_id: session.user.id, plano_id: selectedPlan.id, barbeiro_id: selectedBarber.id,
          status: 'active' as any, payment_method: 'cash' as any, cash_payment_confirmed: false, next_billing_date: nextBillingStr,
        }).select('id').single();
        if (insertError) throw insertError;
        // Só agora remove as assinaturas ativas anteriores
        await supabase.from('assinaturas').delete()
          .eq('user_id', session.user.id).eq('status', 'active').neq('id', newSub.id)
          .or(isReplacing ? 'id.not.is.null' : 'cash_payment_confirmed.eq.false');
        // Enviar notificação de assinatura cash (não bloqueia o fluxo)
        sendAssinaturaCashCriadaEvent({
          cliente_id: session.user.id,
          plano_nome: selectedPlan.nome,
          plano_preco: selectedPlan.preco_mensal,
          barbeiro_id: selectedBarber.id,
        }).catch(() => {});
        toast.success("Plano ativado! Agende seu primeiro corte.");
        navigate(`/cliente/agendar?barber=${selectedBarber.id}`);
      } else {
        const { data, error } = await supabase.functions.invoke('create-subscription-pix', {
          body: { planoId: selectedPlan.id, barbeiroId: selectedBarber.id, renew: isReplacing }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
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
      let errorMessage = error?.message || "";
      try {
        if (error?.context && typeof error.context.json === 'function') {
          const body = await error.context.json();
          if (body?.error) errorMessage = body.error;
        }
      } catch {}
      toast.error(errorMessage || "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setCpfError(false);
    if (step === 4) { setStep(3); }
    else if (step === 3) {
      if (isRenewalMode) { navigate("/cliente"); }
      else { setStep(2); setSelectedBarber(null); }
    }
    else if (step === 2) { navigate("/cliente"); }
    else { navigate("/cliente"); }
  };

  const selectedShopName = selectedTenantId === "dub"
    ? "Barbearia DUB"
    : tenants.find(t => t.id === selectedTenantId)?.nome || "";

  const visibleSteps = isRenewalMode || resumePlanId
    ? [3, 4]
    : visitedStep1 || step === 1
      ? [1, 2, 3, 4]
      : [2, 3, 4];
  const totalSteps = visibleSteps.length;
  const currentDisplayStep = Math.max(1, visibleSteps.indexOf(step) + 1);

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  // Na etapa de Planos a barra de navegação global fica visível,
  // então o conteúdo é encurtado e a seta de voltar é ocultada.
  const showBottomNav = step === 2;

  if (checkingMyPlan) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <BottomNavigation />
      </div>
    );
  }

  if (showMyPlan && mySub) {
    return (
      <MeuPlanoView
        sub={mySub}
        onRenovado={() => { void loadMySub(); }}
        onVerPlanos={() => setShowMyPlan(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#FFFFFF]"
      style={
        showBottomNav
          ? { paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }
          : undefined
      }
    >
      {/* Header fixo — Seta circular + Dots (100% idêntico ao fluxo de agendamento) */}
      {step !== 2 && step !== 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#FFFFFF]">
          <div className="max-w-2xl mx-auto px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                aria-label="Voltar"
                className="w-10 h-10 rounded-full bg-white border border-neutral-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 active:scale-90 transition-transform cursor-pointer focus:outline-none"
              >
                <BackArrow size={20} strokeWidth={2.2} />
              </button>

              <StepDots currentStep={currentDisplayStep} totalSteps={totalSteps} />

              <div className="w-10" />
            </div>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative z-10">
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
            <motion.div
              key="step1"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="h-full overflow-y-auto overscroll-contain pt-[calc(max(env(safe-area-inset-top,0px),0.75rem)+3.25rem)] pb-20 px-4 relative z-10"
            >
              <div className="max-w-2xl mx-auto space-y-2.5">
                <div className="mb-6 pt-1">
                  <h2 className="text-[26px] sm:text-[27px] font-bold text-[#111111] tracking-[-0.025em] leading-[1.12] font-display">
                    Sua Barbearia
                  </h2>
                  <p className="text-[13px] text-neutral-500 mt-1">Selecione onde deseja assinar o plano</p>
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
                  onBack={handleBack}
                />
              )}
            </motion.div>
          )}


          {/* ═══ Step 3: Barbeiro ═══ */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="h-full overflow-y-auto overscroll-contain pt-[calc(max(env(safe-area-inset-top,0px),0.75rem)+3.25rem)] pb-24 px-4 relative z-10"
            >
              <div className="max-w-2xl mx-auto">
                <div className="mb-6 pt-1">
                  <h2 className="text-[26px] sm:text-[27px] font-bold text-[#111111] tracking-[-0.025em] leading-[1.12] font-display">
                    Seu barbeiro
                  </h2>
                  <p className="text-[13px] text-neutral-500 mt-1">
                    Escolha o profissional exclusivo do seu plano
                  </p>
                </div>

                {barbers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14">
                    <User className="w-6 h-6 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhum barbeiro disponível</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {barbers.map((barber, index) => (
                      <motion.div key={barber.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                        <BarberCard
                          barber={barber}
                          isSelected={selectedBarber?.id === barber.id}
                          showSelectionIndicator={false}
                          onSelect={() => {
                            setSelectedBarber(barber);
                            setCpfError(false);
                            setStep(4);
                          }}
                          rating={ratings[barber.id]}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 4: Forma de pagamento (100% idêntico ao fluxo de agendamento normal) ═══ */}
          {step === 4 && (
            !selectedPlan ? (
              <motion.div key="step4-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center h-full">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key="step4"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="h-full overflow-y-auto overscroll-contain pt-[calc(max(env(safe-area-inset-top,0px),0.75rem)+3.25rem)] pb-36 px-4 relative z-10"
              >
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6 pt-1">
                    <h2 className="text-[26px] sm:text-[27px] font-bold text-[#111111] tracking-[-0.025em] leading-[1.12] font-display">
                      Forma de pagamento
                    </h2>
                  </div>

                  <div className="rounded-[22px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-2 space-y-1 mb-5">
                    {isPaymentConfigLoading && (
                      <p role="status" className="flex items-center gap-2 p-3.5 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando pagamento...
                      </p>
                    )}

                    {!isPaymentConfigLoading && !pixAvailable && !cashAvailable && (
                      <p role="status" className="p-3.5 text-sm text-muted-foreground">
                        Nenhuma forma de pagamento disponível para este profissional.
                      </p>
                    )}

                    {!isPaymentConfigLoading && pixAvailable && (
                      <div>
                        <PaymentOption
                          value="pix"
                          selected={selectedPaymentMethod === "pix"}
                          onSelect={() => {
                            setCpfError(false);
                            setSelectedPaymentMethod("pix");
                          }}
                          title="PIX"
                          description="Confirmação instantânea e segura"
                          icon={<img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />}
                        />

                        <AnimatePresence>
                          {selectedPaymentMethod === "pix" && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden px-1 pb-1 pt-1"
                            >
                              <div
                                className={cn(
                                  "p-3.5 rounded-xl transition-all",
                                  cpfError
                                    ? "bg-red-50/90 border-2 border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                                    : "bg-neutral-50/80 border border-neutral-200/70"
                                )}
                              >
                                <label
                                  className={cn(
                                    "text-[11px] font-semibold block mb-1.5 transition-colors",
                                    cpfError ? "text-red-600" : "text-neutral-500"
                                  )}
                                >
                                  {cpfError ? "Informe um CPF válido para continuar" : "CPF para emissão do PIX (obrigatório)"}
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={cpfInput}
                                  onChange={(e) => {
                                    setCpfInput(formatCPF(e.target.value));
                                    if (cpfError) setCpfError(false);
                                  }}
                                  placeholder="000.000.000-00"
                                  className={cn(
                                    "w-full bg-transparent border-none outline-none text-[15px] font-medium placeholder:text-neutral-300 transition-colors",
                                    cpfError ? "text-red-700 font-semibold" : "text-neutral-900"
                                  )}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {!isPaymentConfigLoading && cashAvailable && (
                      <PaymentOption
                        value="cash"
                        selected={selectedPaymentMethod === "cash"}
                        onSelect={() => {
                          setCpfError(false);
                          setSelectedPaymentMethod("cash");
                        }}
                        title="Pagar na Barbearia"
                        description={pixAvailable ? "Pagamento presencial no dia" : "Este barbeiro só aceita pagamento na barbearia"}
                        icon={<Landmark className={cn("w-5 h-5", selectedPaymentMethod === "cash" ? "text-primary" : "text-muted-foreground/40")} />}
                      />
                    )}
                  </div>

                  <div className="mb-5">
                    <p className="text-[13px] font-medium text-neutral-500 mb-2 px-1">
                      Local do Atendimento
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="w-full text-left rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-3.5 flex items-center justify-between active:scale-[0.99] transition-transform cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MapPin className="w-5 h-5 text-neutral-700 flex-shrink-0" strokeWidth={1.8} />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-neutral-900 truncate">
                            {selectedShopName || "Barbearia DUB"}
                          </p>
                          <p className="text-[12px] text-neutral-500 truncate mt-0.5">
                            {selectedBarber ? `${selectedBarber.apelido} • ` : ""}{selectedPlan.nome}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                    </button>
                  </div>

                  {(() => {
                    const planPrice = Number(selectedPlan?.preco_mensal ?? 0);
                    const fee = getServiceFee(selectedPaymentMethod);
                    const total = planPrice + fee;
                    return (
                      <div className="mb-6">
                        <p className="text-[13px] font-medium text-neutral-500 mb-2 px-1">
                          Resumo
                        </p>
                        <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 space-y-3">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-neutral-600 truncate">
                              {selectedPlan.nome}
                            </span>
                            <span className="tabular-nums font-medium flex-shrink-0 text-neutral-900">
                              R$ {planPrice.toFixed(2).replace('.', ',')}
                            </span>
                          </div>

                          {fee > 0 && (
                            <div className="flex items-center justify-between text-[13px]">
                              <span className="text-neutral-600">Taxa de serviço</span>
                              <span className="text-neutral-900 font-medium tabular-nums">
                                R$ {fee.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          )}

                          <div className="border-b border-dashed border-neutral-200 my-2" />

                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[14px] font-medium text-neutral-900">Total</span>
                            <span className="text-[18px] font-bold tabular-nums text-neutral-900">
                              R$ {total.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Floating Bottom Bar — 100% idêntico ao Passo 5 do Agendamento */}
      <FloatingActionBar
        isVisible={
          step === 4 &&
          !!selectedPlan &&
          !isPaymentConfigLoading &&
          !!selectedPaymentMethod &&
          (!hasActiveSubscription || isRenewalMode || isChangeMode)
        }
        onContinue={handleProceedFromPayment}
        label={selectedPaymentMethod === "pix" ? "Gerar PIX" : "Finalizar"}
        isLoading={loading}
        loadingLabel="Processando..."
      />

      {showBottomNav && <BottomNavigation />}
    </div>
  );
};

export default ClienteAssinar;
