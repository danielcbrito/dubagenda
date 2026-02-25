import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, Scissors, ChevronRight, Check, Crown, Navigation, Loader2, Star, ArrowLeft, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoDub from "@/assets/logo-dub.png";

// ── Types ──
interface Tenant {
  id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
  cidade: string | null;
  bairro: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  distance?: number | null;
  avgRating?: number | null;
  totalReviews?: number;
}

// ── Utils ──
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

// ── Sub-components ──

/** Renders 1-5 star rating inline */
function RatingStars({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex items-center gap-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "w-3 h-3",
              i <= full
                ? "fill-amber-400 text-amber-400"
                : i === full + 1 && hasHalf
                  ? "fill-amber-400/50 text-amber-400"
                  : "fill-muted/40 text-muted-foreground/20"
            )}
          />
        ))}
      </span>
      <span className="text-[10px] font-semibold tabular-nums text-foreground/80">{rating.toFixed(1)}</span>
      <span className="text-[9px] text-muted-foreground/40">({count})</span>
    </span>
  );
}

/** Distance badge */
function DistanceBadge({ km }: { km: number }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums",
      "bg-primary/8 text-primary border border-primary/15"
    )}>
      <Route className="w-3 h-3" />
      {formatDistance(km)}
    </span>
  );
}

/** Premium back button with rounded arrow */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "w-10 h-10 flex items-center justify-center",
        "rounded-2xl bg-card border border-border/50",
        "active:scale-90 transition-all duration-200",
        "shadow-[var(--shadow-soft)]"
      )}
      aria-label="Voltar"
    >
      <ArrowLeft className="w-[18px] h-[18px] text-foreground/70" strokeWidth={2.2} strokeLinecap="round" />
    </motion.button>
  );
}

/** Location status indicator */
function LocationIndicator({ status }: { status: "idle" | "requesting" | "granted" | "denied" }) {
  if (status === "idle" || status === "denied") return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className={cn(
        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-3",
        status === "requesting"
          ? "bg-primary/5 border border-primary/10"
          : "bg-emerald-500/5 border border-emerald-500/10"
      )}>
        {status === "requesting" ? (
          <>
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-[12px] text-primary/80 font-medium">Localizando você...</span>
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4 text-emerald-500" />
            <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">
              Ordenado por proximidade
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** DUB reference card */
function DubReferenceCard({
  dubRating,
  currentPreferred,
  saving,
  leftDub,
  onSelect,
}: {
  dubRating: { avg: number; count: number } | null;
  currentPreferred: string | null;
  saving: string | null;
  leftDub: boolean;
  onSelect: () => void;
}) {
  const isSelected = !currentPreferred;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
    >
      <button
        onClick={onSelect}
        disabled={!!saving}
        className={cn(
          "w-full rounded-2xl border p-4 text-left relative overflow-hidden",
          "active:scale-[0.98] transition-all duration-200",
          "bg-card",
          "shadow-[var(--shadow-card)]",
          "border-primary/20",
          saving === "dub" && "ring-2 ring-primary/30",
          saving && saving !== "dub" && "opacity-50"
        )}
      >
        {/* Subtle shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-4">
          {/* Logo */}
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden",
            "bg-muted/30 border border-primary/10"
          )}>
            <img src={logoDub} alt="Barbearia DUB" className="w-9 h-9 object-contain" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[15px] font-bold text-foreground tracking-tight">Barbearia DUB</span>
              <span className={cn(
                "inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest",
                "bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0"
              )}>
                <Crown className="w-2.5 h-2.5" />
                Referência
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground/70 mb-1.5">
              Corte masculino premium
            </p>
            {dubRating && (
              <RatingStars rating={dubRating.avg} count={dubRating.count} />
            )}
          </div>

          {/* Action indicator */}
          <div className="flex-shrink-0">
            {saving === "dub" ? (
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : isSelected ? (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-[var(--shadow-glow-red)]">
                <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
              </div>
            ) : (
              <ChevronRight className="w-5 h-5 text-primary/40" />
            )}
          </div>
        </div>

        {/* Return to DUB CTA */}
        <AnimatePresence>
          {leftDub && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative mt-3 pt-3 border-t border-border/20"
            >
              <p className="text-[11px] text-primary/80 font-semibold text-center tracking-wide">
                ← Voltar para atendimento exclusivo DUB
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

/** Tenant card for partner barbershops */
function TenantCard({
  tenant,
  index,
  isCurrent,
  saving,
  onSelect,
}: {
  tenant: Tenant & { distance?: number | null };
  index: number;
  isCurrent: boolean;
  saving: string | null;
  onSelect: () => void;
}) {
  return (
    <motion.button
      key={tenant.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onSelect}
      disabled={!!saving || isCurrent}
      className={cn(
        "w-full rounded-2xl border p-4 text-left",
        "active:scale-[0.98] transition-all duration-200",
        "bg-card",
        "shadow-[var(--shadow-card)]",
        isCurrent ? "border-primary/25 bg-primary/[0.03]" : "border-border/30",
        saving === tenant.id && "ring-2 ring-primary/30 border-primary/20",
        saving && saving !== tenant.id && !isCurrent && "opacity-40"
      )}
    >
      <div className="flex items-center gap-3.5">
        {/* Avatar */}
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden",
          "bg-muted/40 border border-border/30"
        )}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
          ) : (
            <Scissors className="w-5 h-5 text-muted-foreground/40" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + current badge */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[14px] font-bold text-foreground truncate tracking-tight">
              {tenant.nome}
            </span>
            {isCurrent && (
              <span className={cn(
                "text-[8px] font-bold uppercase tracking-widest",
                "bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0"
              )}>
                Atual
              </span>
            )}
          </div>

          {/* Slogan */}
          {tenant.slogan && (
            <p className="text-[11px] text-muted-foreground/60 truncate mb-1">
              {tenant.slogan}
            </p>
          )}

          {/* Meta row: location + rating + distance */}
          <div className="flex items-center gap-2 flex-wrap">
            {(tenant.bairro || tenant.cidade) && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
                <span className="text-[11px] text-muted-foreground/50 truncate">
                  {[tenant.bairro, tenant.cidade].filter(Boolean).join(", ")}
                </span>
              </span>
            )}

            {tenant.avgRating != null && tenant.totalReviews != null && tenant.totalReviews > 0 && (
              <RatingStars rating={tenant.avgRating} count={tenant.totalReviews} />
            )}

            {tenant.distance != null && (
              <span className="ml-auto flex-shrink-0">
                <DistanceBadge km={tenant.distance} />
              </span>
            )}
          </div>
        </div>

        {/* Right action */}
        <div className="flex-shrink-0">
          {saving === tenant.id ? (
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : isCurrent ? (
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
            </div>
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground/25" />
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ── Main Page ──
const EscolherBarbearia = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPreferred, setCurrentPreferred] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [dubRating, setDubRating] = useState<{ avg: number; count: number } | null>(null);

  const isChangeMode = searchParams.get("mode") === "change";
  const isAuthenticated = !!userId;

  // ── Auth check ──
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("barbearia_preferida_id")
          .eq("id", session.user.id)
          .single();
        if (profile?.barbearia_preferida_id) {
          setCurrentPreferred(profile.barbearia_preferida_id);
        }
      } else if (isChangeMode) {
        navigate("/auth?mode=login");
        return;
      }
      await loadTenants();
    };
    init();
  }, []);

  // ── Geolocation ──
  useEffect(() => {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // ── Load tenants ──
  const loadTenants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("id, nome, slogan, logo_url, cidade, bairro, estado, latitude, longitude")
      .eq("ativo", true)
      .eq("onboarding_completed", true)
      .order("nome");

    if (error) {
      console.error("Erro ao carregar barbearias:", error);
      toast.error("Erro ao carregar barbearias");
      setTenants([]);
      setIsLoading(false);
      return;
    }

    const tenantList = (data as Tenant[]) || [];
    let curatedTenants = tenantList;

    if (tenantList.length > 0) {
      const tenantIds = tenantList.map((t) => t.id);
      const { data: barbers } = await supabase
        .from("barbeiros")
        .select("id, tenant_id")
        .in("tenant_id", tenantIds)
        .eq("ativo", true)
        .is("deleted_at", null);

      const activeTenantIds = new Set(
        (barbers ?? []).map((b) => b.tenant_id).filter((tid): tid is string => !!tid)
      );
      curatedTenants = tenantList.filter((t) => activeTenantIds.has(t.id));

      if (barbers && barbers.length > 0) {
        const barberIds = barbers.map((b) => b.id);
        const { data: reviews } = await supabase
          .from("barbeiro_avaliacoes")
          .select("barber_id, rating")
          .in("barber_id", barberIds);

        if (reviews && reviews.length > 0) {
          const barberToTenant = new Map(barbers.map((b) => [b.id, b.tenant_id]));
          const tenantRatings = new Map<string, { sum: number; count: number }>();
          for (const r of reviews) {
            const tid = barberToTenant.get(r.barber_id);
            if (!tid) continue;
            const cur = tenantRatings.get(tid) || { sum: 0, count: 0 };
            cur.sum += r.rating;
            cur.count += 1;
            tenantRatings.set(tid, cur);
          }
          for (const t of curatedTenants) {
            const stats = tenantRatings.get(t.id);
            if (stats) { t.avgRating = stats.sum / stats.count; t.totalReviews = stats.count; }
          }
        }
      }
    }

    // DUB ratings
    const { data: dubBarbers } = await supabase
      .from("barbeiros")
      .select("id")
      .is("tenant_id", null)
      .eq("ativo", true)
      .is("deleted_at", null);

    if (dubBarbers && dubBarbers.length > 0) {
      const dubBarberIds = dubBarbers.map((b) => b.id);
      const { data: dubReviews } = await supabase
        .from("barbeiro_avaliacoes")
        .select("rating")
        .in("barber_id", dubBarberIds);

      if (dubReviews && dubReviews.length > 0) {
        const sum = dubReviews.reduce((s, r) => s + r.rating, 0);
        setDubRating({ avg: sum / dubReviews.length, count: dubReviews.length });
      }
    }

    setTenants(curatedTenants);
    setIsLoading(false);
  };

  // ── Sort ──
  const sortedTenants = useCallback(() => {
    const mapped = [...tenants].map((t) => ({
      ...t,
      distance: userLocation && t.latitude && t.longitude
        ? haversineDistance(userLocation.lat, userLocation.lng, t.latitude, t.longitude)
        : null,
    }));

    return mapped.sort((a, b) => {
      if (a.distance != null && b.distance != null) {
        const diff = a.distance - b.distance;
        if (Math.abs(diff) > 0.5) return diff;
      }
      if (a.distance != null && b.distance == null) return -1;
      if (a.distance == null && b.distance != null) return 1;
      const rA = a.avgRating ?? 0;
      const rB = b.avgRating ?? 0;
      if (rA !== rB) return rB - rA;
      return (b.totalReviews ?? 0) - (a.totalReviews ?? 0);
    });
  }, [tenants, userLocation]);

  // ── Handlers ──
  const handleSelect = async (tenantId: string) => {
    if (saving) return;
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&origin=discover&tenant=${tenantId}`);
      return;
    }
    setSaving(tenantId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ barbearia_preferida_id: tenantId, signup_origin: "discover" })
        .eq("id", userId);
      if (error) throw error;
      toast.success(isChangeMode ? "Barbearia atualizada!" : "Barbearia selecionada!");
      navigate(isChangeMode ? "/cliente/perfil" : "/cliente");
    } catch (err) {
      console.error("Erro ao salvar barbearia:", err);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(null);
    }
  };

  const handleBackToDub = async () => {
    if (!isAuthenticated) {
      navigate("/auth?mode=signup&origin=dub_exclusive");
      return;
    }
    setSaving("dub");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ barbearia_preferida_id: null, signup_origin: "dub_exclusive" })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Você voltou para o modo DUB Exclusivo!");
      navigate("/cliente");
    } catch (err) {
      console.error("Erro ao voltar para DUB:", err);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setSaving(null);
    }
  };

  const handleBack = () => navigate(isChangeMode ? "/cliente/perfil" : "/");

  // ── Derived ──
  const displayTenants = sortedTenants();
  const filtered = displayTenants.filter((t) =>
    t.nome.toLowerCase().includes(search.toLowerCase()) ||
    (t.bairro && t.bairro.toLowerCase().includes(search.toLowerCase())) ||
    (t.cidade && t.cidade.toLowerCase().includes(search.toLowerCase()))
  );
  const leftDub = !!currentPreferred;

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ══════ Header ══════ */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <BackButton onClick={handleBack} />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          className="mt-4 mb-4"
        >
          <h1 className="text-[20px] font-bold text-foreground tracking-tight leading-tight">
            {isChangeMode ? "Trocar barbearia" : "Encontrar barbearias"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
            {isChangeMode
              ? "Selecione outra unidade como sua preferida"
              : "Escolha a barbearia ideal para você"}
          </p>
        </motion.div>

        {/* Location */}
        <AnimatePresence>
          <LocationIndicator status={locationStatus} />
        </AnimatePresence>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/35" />
          <input
            type="text"
            placeholder="Buscar por nome ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-12 pl-11 pr-4 rounded-2xl text-[14px]",
              "bg-card border border-border/40 text-foreground",
              "placeholder:text-muted-foreground/35",
              "focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10",
              "transition-all duration-200"
            )}
          />
        </motion.div>
      </div>

      {/* ══════ Scrollable ══════ */}
      <div className="flex-1 min-h-0 relative">
        {/* Fade mask */}
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-5 pb-32">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24"
            >
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-[12px] text-muted-foreground/50 mt-4 tracking-wide font-medium">
                Carregando barbearias...
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3 pt-2">
              {/* ═══ DUB Reference Card ═══ */}
              <DubReferenceCard
                dubRating={dubRating}
                currentPreferred={currentPreferred}
                saving={saving}
                leftDub={leftDub}
                onSelect={handleBackToDub}
              />

              {/* ── Section divider ── */}
              {filtered.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center gap-3 py-2 px-1"
                >
                  <div className="flex-1 h-px bg-border/25" />
                  <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/30 font-bold">
                    Barbearias parceiras
                  </span>
                  <div className="flex-1 h-px bg-border/25" />
                </motion.div>
              )}

              {/* ── Empty state ── */}
              {filtered.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
                    <Scissors className="w-6 h-6 text-muted-foreground/25" />
                  </div>
                  <p className="text-[14px] text-muted-foreground font-semibold">
                    {search ? "Nenhuma barbearia encontrada" : "Nenhuma barbearia disponível"}
                  </p>
                  <p className="text-[12px] text-muted-foreground/40 mt-1.5">
                    {search ? "Tente outro nome ou bairro" : "Novas unidades em breve"}
                  </p>
                </motion.div>
              )}

              {/* ── Tenant cards ── */}
              {filtered.map((tenant, index) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  index={index}
                  isCurrent={currentPreferred === tenant.id}
                  saving={saving}
                  onSelect={() => handleSelect(tenant.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════ Bottom ══════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div
          className="h-8 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
        />
        <div className="bg-background border-t border-border/15 px-5 pb-[env(safe-area-inset-bottom)]">
          <div className="pt-3 pb-3">
            <button
              onClick={handleBack}
              className={cn(
                "w-full text-center text-[13px] text-muted-foreground/45",
                "hover:text-muted-foreground transition-colors duration-200",
                "py-2.5 rounded-xl font-medium"
              )}
            >
              {isChangeMode ? "Cancelar" : "Voltar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EscolherBarbearia;
