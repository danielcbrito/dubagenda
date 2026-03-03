import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, Scissors, Navigation, Loader2, Star, Route, TrendingUp, ChevronRight, Sparkles } from "lucide-react";
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
  isDub?: boolean;
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

const DUB_COORDS = { lat: -23.7219695, lng: -46.7615913 };

/** Skeleton card for loading state */
const SkeletonCard = ({ delay = 0 }: { delay?: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay }}
    className="rounded-2xl border border-border/20 bg-card p-4"
  >
    <div className="flex items-center gap-3.5">
      <div className="w-14 h-14 rounded-2xl bg-muted/40 animate-pulse" />
      <div className="flex-1 space-y-2.5">
        <div className="h-4 w-32 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-3 w-44 bg-muted/30 rounded-md animate-pulse" />
        <div className="flex gap-2">
          <div className="h-5 w-14 bg-muted/30 rounded-md animate-pulse" />
          <div className="h-5 w-16 bg-muted/30 rounded-md animate-pulse" />
        </div>
      </div>
    </div>
  </motion.div>
);

/** Individual barbershop card */
const BarbershopCard = ({
  tenant,
  index,
  isCurrent,
  locationGranted,
  onClick,
}: {
  tenant: Tenant;
  index: number;
  isCurrent: boolean;
  locationGranted: boolean;
  onClick: () => void;
}) => {
  const locationLabel = [tenant.bairro, tenant.cidade].filter(Boolean).join(", ");
  const hasRating = tenant.avgRating != null && (tenant.totalReviews ?? 0) > 0;
  const isHighRated = hasRating && (tenant.avgRating ?? 0) >= 4.5;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.06 + index * 0.05,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileTap={{ scale: 0.975 }}
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-0 text-left overflow-hidden group",
        "transition-all duration-300",
        "bg-card",
        isCurrent
          ? "border-primary/25 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]"
          : "border-border/20 hover:border-border/40",
        "hover:shadow-[0_8px_30px_-10px_hsl(var(--foreground)/0.08)]"
      )}
    >
      <div className="p-4">
        <div className="flex items-center gap-3.5">
          {/* Logo */}
          <div className={cn(
            "relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden",
            "bg-muted/20 border border-border/15",
            "transition-transform duration-300 group-hover:scale-105"
          )}>
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
            ) : tenant.isDub ? (
              <img src={logoDub} alt="DUB" className="w-8 h-8 object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20">
                <span className="text-[18px] font-bold text-muted-foreground/40">
                  {tenant.nome.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {/* Subtle verified dot for high-rated */}
            {isHighRated && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center">
                <Star className="w-2 h-2 fill-white text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-foreground truncate tracking-tight">
                {tenant.nome}
              </span>
            </div>

            {tenant.slogan && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 italic truncate">
                {tenant.slogan}
              </p>
            )}

            {locationLabel && !tenant.slogan && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-[9px] h-[9px] text-muted-foreground/30 shrink-0" />
                <span className="text-[10px] text-muted-foreground/50 truncate">
                  {locationLabel}
                </span>
              </div>
            )}

            {/* Badges row */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {hasRating && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-[3px]",
                  isHighRated
                    ? "bg-amber-500/10 ring-1 ring-amber-500/20"
                    : "bg-muted/40"
                )}>
                  <Star className={cn(
                    "w-[10px] h-[10px]",
                    isHighRated ? "fill-amber-400 text-amber-400" : "fill-amber-400/70 text-amber-400/70"
                  )} />
                  <span className={cn(
                    "text-[10px] font-bold tabular-nums",
                    isHighRated ? "text-amber-500" : "text-foreground/70"
                  )}>
                    {tenant.avgRating!.toFixed(1)}
                  </span>
                  <span className="text-[8px] text-muted-foreground/40">
                    ({tenant.totalReviews})
                  </span>
                </span>
              )}

              {locationGranted && tenant.distance != null && (
                <span className="inline-flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-[3px]">
                  <Navigation className="w-[9px] h-[9px] text-primary/50" />
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground/60">
                    {formatDistance(tenant.distance)}
                  </span>
                </span>
              )}

              {locationLabel && tenant.slogan && (
                <span className="inline-flex items-center gap-1 bg-muted/30 rounded-lg px-2 py-[3px]">
                  <MapPin className="w-[9px] h-[9px] text-muted-foreground/30" />
                  <span className="text-[9px] text-muted-foreground/40 truncate max-w-[100px]">
                    {locationLabel}
                  </span>
                </span>
              )}

              {isCurrent && (
                <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-[3px] rounded-lg ring-1 ring-primary/15">
                  Sua barbearia
                </span>
              )}
            </div>
          </div>

          {/* Arrow hint */}
          <ChevronRight className="w-4 h-4 text-muted-foreground/15 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground/30" />
        </div>
      </div>
    </motion.button>
  );
};

// ── Main Page ──
const EscolherBarbearia = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPreferred, setCurrentPreferred] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
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

  // ── Auto-open ──
  useEffect(() => {
    if (!shouldOpenCurrent || isLoading || hasAutoOpened) return;
    setHasAutoOpened(true);
    const dubTenant = allTenants.find(t => t.isDub);
    if (!currentPreferred) {
      if (dubTenant) setSelectedShop(dubTenant.id);
      return;
    }
    setSelectedShop(currentPreferred);
  }, [shouldOpenCurrent, isLoading, hasAutoOpened, currentPreferred, allTenants]);

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

  // ── Load tenants (unified list) ──
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
      setAllTenants([]);
      setIsLoading(false);
      return;
    }

    let tenantList = (data as Tenant[]) || [];

    // Mark DUB tenant
    tenantList = tenantList.map(t => ({
      ...t,
      isDub: normalizeText(t.slug ?? "") === "barbeariadub" || normalizeText(t.nome) === "barbeariadub",
    }));

    // Apply DUB fallbacks
    tenantList = tenantList.map(t => {
      if (!t.isDub) return t;
      return {
        ...t,
        slogan: t.slogan || "Corte premium",
        logo_url: t.logo_url || logoDub,
        bairro: t.bairro || "Cidade Ipava",
        cidade: t.cidade || "São Paulo",
        estado: t.estado || "SP",
        latitude: t.latitude ?? DUB_COORDS.lat,
        longitude: t.longitude ?? DUB_COORDS.lng,
      };
    });

    // Filter only tenants with active barbers (DUB also includes global barbers)
    const tenantIds = tenantList.map(t => t.id);
    const { data: barbers } = await supabase
      .from("barbeiros")
      .select("id, tenant_id")
      .eq("ativo", true)
      .is("deleted_at", null);

    const activeTenantIds = new Set(
      (barbers ?? []).map(b => b.tenant_id).filter((tid): tid is string => !!tid)
    );
    // DUB also counts global barbers (tenant_id IS NULL)
    const hasGlobalBarbers = (barbers ?? []).some(b => !b.tenant_id);
    
    tenantList = tenantList.filter(t => {
      if (t.isDub && hasGlobalBarbers) return true;
      return activeTenantIds.has(t.id);
    });

    // Load ratings
    if (barbers && barbers.length > 0) {
      const barberIds = barbers.map(b => b.id);
      const { data: reviews } = await supabase
        .from("barbeiro_avaliacoes")
        .select("barber_id, rating")
        .in("barber_id", barberIds);

      if (reviews && reviews.length > 0) {
        const barberToTenant = new Map(barbers.map(b => [b.id, b.tenant_id]));
        const tenantRatings = new Map<string, { sum: number; count: number }>();
        const dubTenantId = tenantList.find(t => t.isDub)?.id;

        for (const r of reviews) {
          const tid = barberToTenant.get(r.barber_id);
          // Global barbers (null tenant_id) count for DUB
          const effectiveTid = tid || dubTenantId;
          if (!effectiveTid) continue;
          const cur = tenantRatings.get(effectiveTid) || { sum: 0, count: 0 };
          cur.sum += r.rating;
          cur.count += 1;
          tenantRatings.set(effectiveTid, cur);
        }

        for (const t of tenantList) {
          const stats = tenantRatings.get(t.id);
          if (stats) {
            t.avgRating = stats.sum / stats.count;
            t.totalReviews = stats.count;
          }
        }
      }
    }

    setAllTenants(tenantList);
    setIsLoading(false);
  };

  // ── Sort: proximity first, then rating. DUB gets subtle 0.3km boost ──
  const sortedTenants = useMemo(() => {
    const mapped = allTenants.map(t => ({
      ...t,
      distance: userLocation && t.latitude && t.longitude
        ? haversineDistance(userLocation.lat, userLocation.lng, t.latitude, t.longitude)
        : null,
    }));

    return mapped.sort((a, b) => {
      // Subtle DUB boost: reduce its distance by 0.3km in comparison
      const distA = a.distance != null ? a.distance - (a.isDub ? 0.3 : 0) : null;
      const distB = b.distance != null ? b.distance - (b.isDub ? 0.3 : 0) : null;

      if (distA != null && distB != null) {
        const diff = distA - distB;
        if (Math.abs(diff) > 0.3) return diff;
      }
      if (distA != null && distB == null) return -1;
      if (distA == null && distB != null) return 1;

      // Same distance tier → higher rating wins
      const rA = a.avgRating ?? 0;
      const rB = b.avgRating ?? 0;
      if (rA !== rB) return rB - rA;

      // Tie-break: more reviews = more trust
      return (b.totalReviews ?? 0) - (a.totalReviews ?? 0);
    });
  }, [allTenants, userLocation]);

  // ── Filtered ──
  const filtered = useMemo(() => {
    if (!search.trim()) return sortedTenants;
    const q = search.toLowerCase();
    return sortedTenants.filter(t =>
      t.nome.toLowerCase().includes(q) ||
      (t.bairro && t.bairro.toLowerCase().includes(q)) ||
      (t.cidade && t.cidade.toLowerCase().includes(q))
    );
  }, [sortedTenants, search]);

  // ── Handlers ──
  const handleSelect = async (tenantId: string) => {
    if (saving) return;
    const tenant = allTenants.find(t => t.id === tenantId);
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&origin=discover&tenant=${tenantId}`);
      return;
    }
    setSaving(tenantId);
    try {
      const updateData = tenant?.isDub
        ? { barbearia_preferida_id: null as string | null, signup_origin: "dub_exclusive" }
        : { barbearia_preferida_id: tenantId, signup_origin: "discover" };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
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

  const handleBack = () => navigate(isChangeMode ? "/cliente/perfil" : "/");

  // ── Selected tenant for detail sheet ──
  const selectedTenant = selectedShop
    ? allTenants.find(t => t.id === selectedShop) || null
    : null;

  const selectedDistance = selectedTenant && userLocation && selectedTenant.latitude && selectedTenant.longitude
    ? haversineDistance(userLocation.lat, userLocation.lng, selectedTenant.latitude, selectedTenant.longitude)
    : null;

  const isDubSelected = (tenantId: string) => {
    const t = allTenants.find(x => x.id === tenantId);
    if (!t?.isDub) return false;
    return !currentPreferred || currentPreferred === t.id;
  };

  const isTenantCurrent = (tenantId: string) => {
    const t = allTenants.find(x => x.id === tenantId);
    if (t?.isDub) return !currentPreferred || currentPreferred === t.id;
    return currentPreferred === tenantId;
  };

  // ── Stats bar ──
  const totalShops = allTenants.length;
  const avgGlobal = allTenants.reduce((s, t) => s + (t.avgRating ?? 0), 0) / Math.max(allTenants.filter(t => t.avgRating).length, 1);

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ══════ Header ══════ */}
      <div className="flex-shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-3">
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
          <div>
            <p className="text-[19px] font-bold text-foreground leading-none tracking-tight">
              {isChangeMode ? "Trocar barbearia" : "Descubra"}
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              {totalShops > 0 && !isLoading
                ? `${totalShops} ${totalShops === 1 ? "barbearia disponível" : "barbearias disponíveis"}`
                : "Encontre seu estilo"
              }
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/25" />
          <input
            type="text"
            placeholder="Buscar por nome, bairro ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-11 pl-9 pr-3 rounded-xl text-[13px]",
              "bg-card border border-border/20 text-foreground",
              "placeholder:text-muted-foreground/35",
              "focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10",
              "transition-all duration-200"
            )}
          />
        </div>

        {/* Location status hint */}
        {locationStatus === "granted" && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-1.5 mt-2 px-1"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500/60 font-medium">Ordenado por proximidade</span>
          </motion.div>
        )}
      </div>

      {/* ══════ Scrollable list ══════ */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-4 pb-24">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              {[0, 1, 2, 3].map(i => (
                <SkeletonCard key={i} delay={i * 0.08} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-20"
            >
              <div className="w-14 h-14 rounded-2xl bg-card border border-border/20 flex items-center justify-center mb-3">
                <Scissors className="w-6 h-6 text-muted-foreground/20" />
              </div>
              <p className="text-[13px] font-medium text-muted-foreground/50">
                {search ? "Nenhum resultado encontrado" : "Sem barbearias disponíveis"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-2 text-[11px] text-primary/60 hover:text-primary transition-colors"
                >
                  Limpar busca
                </button>
              )}
            </motion.div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {filtered.map((tenant, index) => (
                <BarbershopCard
                  key={tenant.id}
                  tenant={tenant}
                  index={index}
                  isCurrent={isTenantCurrent(tenant.id)}
                  locationGranted={locationStatus === "granted"}
                  onClick={() => setSelectedShop(tenant.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════ Detail Sheet ══════ */}
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
          distance={selectedDistance}
          latitude={selectedTenant.latitude}
          longitude={selectedTenant.longitude}
          isCurrent={isTenantCurrent(selectedTenant.id)}
          saving={saving === selectedTenant.id}
          onSelect={() => handleSelect(selectedTenant.id)}
          isDub={selectedTenant.isDub}
          includeGlobalBarbers={!!selectedTenant.isDub}
        />
      )}
    </div>
  );
};

export default EscolherBarbearia;
