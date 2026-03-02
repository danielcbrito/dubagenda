import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Search, Scissors, Crown, Navigation, Loader2, Star, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoDub from "@/assets/logo-dub.png";
import { BarbershopDetailSheet } from "@/components/discover/BarbershopDetailSheet";

// ── Types ──
interface Tenant {
  id: string;
  nome: string;
  slug?: string | null;
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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

// ── DUB Coordinates (Rua Ferrador, 108 – Cidade Ipava, São Paulo) ──
const DUB_COORDS = { lat: -23.7219695, lng: -46.7615913 };

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
  const [dubTenant, setDubTenant] = useState<Tenant | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null); // "dub" or tenant id
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const isChangeMode = searchParams.get("mode") === "change";
  const shouldOpenCurrent = searchParams.get("open") === "current";
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

  // ── Auto-open current barbershop when coming from profile ──
  useEffect(() => {
    if (!shouldOpenCurrent || isLoading || hasAutoOpened) return;
    setHasAutoOpened(true);

    if (!currentPreferred) {
      setSelectedShop("dub");
      return;
    }

    if (dubTenant?.id && currentPreferred === dubTenant.id) {
      setSelectedShop("dub");
      return;
    }

    setSelectedShop(currentPreferred);
  }, [shouldOpenCurrent, isLoading, hasAutoOpened, currentPreferred, dubTenant?.id]);

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
      .select("id, nome, slug, slogan, logo_url, cidade, bairro, estado, latitude, longitude")
      .eq("ativo", true)
      .eq("onboarding_completed", true)
      .order("nome");

    if (error) {
      console.error("Erro ao carregar barbearias:", error);
      toast.error("Erro ao carregar barbearias");
      setTenants([]);
      setDubTenant(null);
      setIsLoading(false);
      return;
    }

    const tenantList = (data as Tenant[]) || [];
    let curatedTenants = tenantList;
    let dubTenantFromList: Tenant | null = null;

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

      dubTenantFromList =
        curatedTenants.find((t) => {
          const slugNormalized = normalizeText(t.slug ?? "");
          const nameNormalized = normalizeText(t.nome ?? "");
          return slugNormalized === "barbeariadub" || nameNormalized === "barbeariadub";
        }) ?? null;

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
            if (stats) {
              t.avgRating = stats.sum / stats.count;
              t.totalReviews = stats.count;
            }
          }
        }
      }
    }

    const partnerTenants = curatedTenants.filter((t) => t.id !== dubTenantFromList?.id);

    let dubBarbersQuery = supabase
      .from("barbeiros")
      .select("id")
      .eq("ativo", true)
      .is("deleted_at", null);

    if (dubTenantFromList?.id) {
      dubBarbersQuery = dubBarbersQuery.or(`tenant_id.eq.${dubTenantFromList.id},tenant_id.is.null`);
    } else {
      dubBarbersQuery = dubBarbersQuery.is("tenant_id", null);
    }

    const { data: dubBarbers } = await dubBarbersQuery;

    if (dubBarbers && dubBarbers.length > 0) {
      const dubBarberIds = dubBarbers.map((b) => b.id);
      const { data: dubReviews } = await supabase
        .from("barbeiro_avaliacoes")
        .select("rating")
        .in("barber_id", dubBarberIds);

      if (dubReviews && dubReviews.length > 0) {
        const sum = dubReviews.reduce((s, r) => s + r.rating, 0);
        setDubRating({ avg: sum / dubReviews.length, count: dubReviews.length });
      } else {
        setDubRating(null);
      }
    } else {
      setDubRating(null);
    }

    setDubTenant(dubTenantFromList);
    setTenants(partnerTenants);
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
  const isDubSelected = !currentPreferred || (dubTenant?.id ? currentPreferred === dubTenant.id : false);
  const dubCoords = {
    lat: dubTenant?.latitude ?? DUB_COORDS.lat,
    lng: dubTenant?.longitude ?? DUB_COORDS.lng,
  };
  const dubDistance = userLocation
    ? haversineDistance(userLocation.lat, userLocation.lng, dubCoords.lat, dubCoords.lng)
    : null;
  const dubLocationLabel = [dubTenant?.bairro ?? "Cidade Ipava", dubTenant?.cidade ?? "São Paulo"].filter(Boolean).join(", ");

  // ── Selected tenant for sheet ──
  const selectedTenant = selectedShop && selectedShop !== "dub"
    ? filtered.find(t => t.id === selectedShop) || null
    : null;

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ══════ Header ══════ */}
      <div className="flex-shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-secondary/50 active:scale-95 transition-all text-foreground"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10a4 4 0 0 1 4 4v1" />
            </svg>
          </button>
          <p className="text-[19px] font-medium text-foreground leading-none">
            {isChangeMode ? "Trocar barbearia" : "Barbearias"}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
          <input
            type="text"
            placeholder="Buscar por nome, bairro ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-10 pl-9 pr-3 rounded-xl text-[13px]",
              "bg-card border border-border/30 text-foreground",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:border-primary/30",
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
              <p className="text-[11px] text-muted-foreground/40 mt-3">Buscando barbearias...</p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">

              {/* ═══ DUB Card — Premium ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <button
                  onClick={() => setSelectedShop("dub")}
                  className={cn(
                    "w-full rounded-2xl border p-0 text-left overflow-hidden",
                    "active:scale-[0.98] transition-all duration-200",
                    "bg-card border-primary/15 shadow-soft",
                  )}
                >
                  {/* Inner layout */}
                  <div className="p-3.5">
                    <div className="flex items-center gap-3.5">
                      {/* Logo — elevated */}
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden",
                        "bg-background border-2 border-border/15",
                        "shadow-md shadow-background/50"
                      )}>
                        {dubTenant?.logo_url ? (
                          <img src={dubTenant.logo_url} alt={dubTenant.nome} className="w-full h-full object-cover" />
                        ) : (
                          <img src={logoDub} alt="DUB" className="w-8 h-8 object-contain" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[15px] font-bold text-foreground tracking-tight">{dubTenant?.nome ?? "Barbearia DUB"}</span>
                          <Crown className="w-3 h-3 text-primary/50" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dubTenant?.slogan ?? "Corte premium"} • {dubLocationLabel}</p>

                        {/* Badges row */}
                        <div className="flex items-center gap-2 mt-2">
                          {dubRating && (
                            <span className="inline-flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
                              <Star className="w-[10px] h-[10px] fill-amber-400 text-amber-400" />
                              <span className="text-[10px] font-bold tabular-nums text-foreground/80">{dubRating.avg.toFixed(1)}</span>
                            </span>
                          )}
                          {locationStatus === "granted" && dubDistance != null && (
                            <span className="inline-flex items-center gap-0.5 bg-muted/50 rounded-md px-1.5 py-0.5">
                              <Route className="w-[10px] h-[10px] text-muted-foreground/50" />
                              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground/60">{formatDistance(dubDistance)}</span>
                            </span>
                          )}
                          {isDubSelected && (
                            <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                              Atual
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>

              {/* ── Divider ── */}
              {filtered.length > 0 && (
                <div className="flex items-center gap-2 py-1 px-0.5">
                  <div className="flex-1 h-px bg-border/10" />
                  <span className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/20 font-bold">
                    Parceiras
                  </span>
                  <div className="flex-1 h-px bg-border/10" />
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
                    onClick={() => setSelectedShop(tenant.id)}
                    className={cn(
                      "w-full rounded-2xl border p-3.5 text-left",
                      "active:scale-[0.985] transition-all duration-200",
                      "bg-card shadow-soft",
                      isCurrent ? "border-primary/20" : "border-border/30",
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Logo */}
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
                        "bg-muted/30 border border-border/20"
                      )}>
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Scissors className="w-5 h-5 text-muted-foreground/30" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-bold text-foreground truncate tracking-tight">
                            {tenant.nome}
                          </span>
                        </div>

                        {(tenant.bairro || tenant.cidade) && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-[9px] h-[9px] text-muted-foreground/40 shrink-0" />
                            <span className="text-[10px] text-muted-foreground/60 truncate">
                              {[tenant.bairro, tenant.cidade].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}

                        {/* Badges */}
                        <div className="flex items-center gap-2 mt-1.5">
                          {tenant.avgRating != null && tenant.totalReviews != null && tenant.totalReviews > 0 && (
                            <span className="inline-flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
                              <Star className="w-[10px] h-[10px] fill-amber-400 text-amber-400" />
                              <span className="text-[10px] font-bold tabular-nums text-foreground/80">{tenant.avgRating.toFixed(1)}</span>
                            </span>
                          )}

                          {locationStatus === "granted" && tenant.distance != null && (
                            <span className="inline-flex items-center gap-0.5 bg-muted/50 rounded-md px-1.5 py-0.5">
                              <Route className="w-[10px] h-[10px] text-muted-foreground/50" />
                              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground/60">{formatDistance(tenant.distance)}</span>
                            </span>
                          )}

                          {isCurrent && (
                            <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                              Atual
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════ Detail Sheet — DUB ══════ */}
      <BarbershopDetailSheet
        open={selectedShop === "dub"}
        onClose={() => setSelectedShop(null)}
        tenantId={dubTenant?.id ?? null}
        tenantName={dubTenant?.nome ?? "Barbearia DUB"}
        tenantLogo={dubTenant?.logo_url ?? logoDub}
        tenantSlogan={dubTenant?.slogan ?? "Corte premium"}
        tenantBairro={dubTenant?.bairro ?? "Cidade Ipava"}
        tenantCidade={dubTenant?.cidade ?? "São Paulo"}
        tenantEstado={dubTenant?.estado ?? "SP"}
        avgRating={dubRating?.avg ?? null}
        totalReviews={dubRating?.count ?? 0}
        distance={dubDistance}
        latitude={dubTenant?.latitude ?? DUB_COORDS.lat}
        longitude={dubTenant?.longitude ?? DUB_COORDS.lng}
        isCurrent={isDubSelected}
        saving={saving === "dub"}
        onSelect={handleBackToDub}
        isDub
        includeGlobalBarbers={!!dubTenant?.id}
      />

      {/* ══════ Detail Sheet — Tenant ══════ */}
      {selectedTenant && (
        <BarbershopDetailSheet
          open={!!selectedTenant}
          onClose={() => setSelectedShop(null)}
          tenantId={selectedTenant.id}
          tenantName={selectedTenant.nome}
          tenantLogo={selectedTenant.logo_url}
          tenantSlogan={selectedTenant.slogan}
          tenantBairro={selectedTenant.bairro}
          tenantCidade={selectedTenant.cidade}
          tenantEstado={selectedTenant.estado}
          avgRating={selectedTenant.avgRating ?? null}
          totalReviews={selectedTenant.totalReviews ?? 0}
          distance={selectedTenant.distance ?? null}
          latitude={selectedTenant.latitude}
          longitude={selectedTenant.longitude}
          isCurrent={currentPreferred === selectedTenant.id}
          saving={saving === selectedTenant.id}
          onSelect={() => handleSelect(selectedTenant.id)}
        />
      )}
    </div>
  );
};

export default EscolherBarbearia;
