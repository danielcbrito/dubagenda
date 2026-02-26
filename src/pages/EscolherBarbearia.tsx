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

function RatingStars({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="w-[10px] h-[10px] fill-amber-400 text-amber-400" />
      <span className="text-[10px] font-semibold tabular-nums text-foreground/70">{rating.toFixed(1)}</span>
      <span className="text-[9px] text-muted-foreground/40">({count})</span>
    </span>
  );
}

function DistanceBadge({ km }: { km: number | null; }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-medium tabular-nums text-muted-foreground/50">
      <Route className="w-[10px] h-[10px]" />
      {km != null ? formatDistance(km) : "—"}
    </span>
  );
}

// ── DUB Coordinates (Rua Ferrador, 108 – Cidade Ipava, São Paulo) ──
const DUB_COORDS = { lat: -23.635, lng: -46.685 };

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
  const isDubSelected = !currentPreferred;

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ══════ Header ══════ */}
      <div className="flex-shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card/80 border border-border/30 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          </button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-foreground tracking-tight">
              {isChangeMode ? "Trocar barbearia" : "Barbearias"}
            </h1>
          </div>
          {locationStatus === "granted" && (
            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-500 font-medium">
              <Navigation className="w-[10px] h-[10px]" />
              Próximas
            </span>
          )}
          {locationStatus === "requesting" && (
            <Loader2 className="w-3 h-3 text-muted-foreground/40 animate-spin" />
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
          <input
            type="text"
            placeholder="Buscar barbearia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-10 pl-9 pr-3 rounded-xl text-[13px]",
              "bg-card/60 border border-border/30 text-foreground",
              "placeholder:text-muted-foreground/30",
              "focus:outline-none focus:border-primary/25",
              "transition-colors duration-150"
            )}
          />
        </div>
      </div>

      {/* ══════ Scrollable ══════ */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-3 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-4 pb-24">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-[11px] text-muted-foreground/40 mt-3">Carregando...</p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {/* ═══ DUB Card ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <button
                  onClick={handleBackToDub}
                  disabled={!!saving}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left",
                    "active:scale-[0.99] transition-all duration-150",
                    "bg-card/80 border-primary/15",
                    saving === "dub" && "opacity-70",
                    saving && saving !== "dub" && "opacity-40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-muted/20 border border-border/20">
                      <img src={logoDub} alt="DUB" className="w-6 h-6 object-contain" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[13px] font-semibold text-foreground">Barbearia DUB</span>
                        <Crown className="w-[10px] h-[10px] text-primary/60" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground/50">Corte premium</span>
                        {dubRating && (
                          <RatingStars rating={dubRating.avg} count={dubRating.count} />
                        )}
                        {locationStatus === "granted" && userLocation && (
                          <DistanceBadge km={haversineDistance(userLocation.lat, userLocation.lng, DUB_COORDS.lat, DUB_COORDS.lng)} />
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {saving === "dub" ? (
                        <div className="w-4 h-4 border-[1.5px] border-primary/25 border-t-primary rounded-full animate-spin" />
                      ) : isDubSelected ? (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground/20" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {leftDub && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[10px] text-primary/60 font-medium mt-2 pt-2 border-t border-border/10 text-center"
                      >
                        Voltar para DUB
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>

              {/* ── Divider ── */}
              {filtered.length > 0 && (
                <div className="flex items-center gap-2 py-1.5 px-0.5">
                  <div className="flex-1 h-px bg-border/15" />
                  <span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground/25 font-semibold">
                    Parceiras
                  </span>
                  <div className="flex-1 h-px bg-border/15" />
                </div>
              )}

              {/* ── Empty state ── */}
              {filtered.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center py-14"
                >
                  <Scissors className="w-5 h-5 text-muted-foreground/15 mb-2" />
                  <p className="text-[12px] text-muted-foreground/40">
                    {search ? "Nenhum resultado" : "Sem barbearias parceiras"}
                  </p>
                </motion.div>
              )}

              {/* ── Tenant cards ── */}
              {filtered.map((tenant, index) => {
                const isCurrent = currentPreferred === tenant.id;
                return (
                  <motion.button
                    key={tenant.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + index * 0.03, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    onClick={() => handleSelect(tenant.id)}
                    disabled={!!saving || isCurrent}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left",
                      "active:scale-[0.99] transition-all duration-150",
                      "bg-card/60",
                      isCurrent ? "border-primary/20" : "border-border/20",
                      saving === tenant.id && "opacity-70",
                      saving && saving !== tenant.id && !isCurrent && "opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-muted/20 border border-border/15">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Scissors className="w-4 h-4 text-muted-foreground/25" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[13px] font-semibold text-foreground truncate">
                            {tenant.nome}
                          </span>
                          {isCurrent && (
                            <span className="text-[7px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-px rounded-full shrink-0">
                              Atual
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {(tenant.bairro || tenant.cidade) && (
                            <span className="inline-flex items-center gap-0.5 min-w-0">
                              <MapPin className="w-[10px] h-[10px] text-muted-foreground/25 shrink-0" />
                              <span className="text-[10px] text-muted-foreground/40 truncate">
                                {[tenant.bairro, tenant.cidade].filter(Boolean).join(", ")}
                              </span>
                            </span>
                          )}

                          {tenant.avgRating != null && tenant.totalReviews != null && tenant.totalReviews > 0 && (
                            <RatingStars rating={tenant.avgRating} count={tenant.totalReviews} />
                          )}

                          {locationStatus === "granted" && (
                            <DistanceBadge km={tenant.distance ?? null} />
                          )}
                        </div>
                      </div>

                      {/* Right */}
                      <div className="shrink-0">
                        {saving === tenant.id ? (
                          <div className="w-4 h-4 border-[1.5px] border-primary/25 border-t-primary rounded-full animate-spin" />
                        ) : isCurrent ? (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                          </div>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground/15" />
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EscolherBarbearia;
