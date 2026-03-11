import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Scissors, Star, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoDub from "@/assets/logo-dub.png";


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
  is_sede?: boolean;
  tenant_id?: string;
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

// formatDistance removed — using inline natural language in cards

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
    className="py-5 border-b border-border/10"
  >
    <div className="flex items-center gap-4">
      <div className="w-[52px] h-[52px] rounded-[14px] bg-muted/30 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-[14px] w-28 bg-muted/30 rounded animate-pulse" />
        <div className="h-[11px] w-40 bg-muted/20 rounded animate-pulse" />
      </div>
      <div className="w-8 h-8 rounded-full bg-muted/20 animate-pulse" />
    </div>
  </motion.div>
);

/** Individual barbershop card — editorial minimal */
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
  const hasRating = tenant.avgRating != null && (tenant.totalReviews ?? 0) > 0;

  // Clean distance text
  const distanceText = locationGranted && tenant.distance != null
    ? tenant.distance < 1
      ? `a ${Math.round(tenant.distance * 1000)}m de você`
      : tenant.distance < 10
        ? `a ${tenant.distance.toFixed(1)}km de você`
        : `a ${Math.round(tenant.distance)}km de você`
    : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.04 + index * 0.04,
        duration: 0.35,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full py-4 text-left group",
        "transition-all duration-200",
        index > 0 && "border-t border-border/8"
      )}
    >
      <div className="flex items-center gap-3.5">
        {/* Logo — clean rounded square */}
        <div className={cn(
          "relative w-[52px] h-[52px] rounded-[14px] flex items-center justify-center shrink-0 overflow-hidden",
          "bg-card border border-border/15",
          "transition-transform duration-300 group-active:scale-95"
        )}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
          ) : tenant.isDub ? (
            <img src={logoDub} alt="DUB" className="w-7 h-7 object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/20">
              <span className="text-[17px] font-bold text-muted-foreground/30">
                {tenant.nome.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Info — minimal, clean */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-foreground truncate leading-tight">
              {tenant.nome}
            </span>
            {hasRating && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Star className="w-[10px] h-[10px] fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-medium tabular-nums text-foreground/60">
                  {tenant.avgRating!.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          {/* Subtitle: slogan or location — only ONE line */}
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate leading-tight">
            {tenant.slogan || [tenant.bairro, tenant.cidade].filter(Boolean).join(", ") || "Barbearia"}
          </p>

          {/* Distance — natural language, subtle */}
          {distanceText && (
            <p className="text-[10px] text-primary/50 mt-1 font-medium">
              {distanceText}
            </p>
          )}
        </div>

        {/* Minimal arrow */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted/15 transition-colors group-hover:bg-muted/30">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
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
    const targetId = currentPreferred || allTenants.find(t => t.isDub)?.id;
    if (targetId) {
      const target = allTenants.find(t => t.id === targetId);
      if (target) {
        const slug = target.slug || target.id;
        navigate(`/${slug}?from=${isChangeMode ? "change" : "discover"}`, { replace: true });
      }
    }
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
      const updateData = {
        barbearia_preferida_id: tenantId,
        signup_origin: tenant?.isDub ? "dub_exclusive" : "discover",
      };

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


  const isTenantCurrent = (tenantId: string) => {
    return currentPreferred === tenantId;
  };

  // ── Stats bar ──
  const totalShops = allTenants.length;
  const avgGlobal = allTenants.reduce((s, t) => s + (t.avgRating ?? 0), 0) / Math.max(allTenants.filter(t => t.avgRating).length, 1);

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ══════ Header ══════ */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/30 active:scale-90 transition-all text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10a4 4 0 0 1 4 4v1" />
            </svg>
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-foreground leading-none tracking-tight">
              {isChangeMode ? "Trocar barbearia" : "Encontre seu estilo"}
            </h1>
            {totalShops > 0 && !isLoading && (
              <p className="text-[10px] text-muted-foreground/35 mt-0.5 font-medium">
                {totalShops} {totalShops === 1 ? "barbearia" : "barbearias"} perto de você
              </p>
            )}
          </div>
        </div>

        {/* Search — clean pill */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/20" />
          <input
            type="text"
            placeholder="Buscar barbearia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-10 pl-10 pr-4 rounded-full text-[13px]",
              "bg-muted/15 border-0 text-foreground",
              "placeholder:text-muted-foreground/30",
              "focus:outline-none focus:ring-1 focus:ring-border/30",
              "transition-all duration-200"
            )}
          />
        </div>
      </div>

      {/* ══════ Scrollable list ══════ */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-5 pb-24">
          {isLoading ? (
            <div className="pt-2">
              {[0, 1, 2, 3, 4].map(i => (
                <SkeletonCard key={i} delay={i * 0.06} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-20"
            >
              <Scissors className="w-6 h-6 text-muted-foreground/15 mb-3" />
              <p className="text-[13px] text-muted-foreground/40">
                {search ? "Nenhum resultado" : "Sem barbearias disponíveis"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-2 text-[11px] text-primary/50 hover:text-primary transition-colors"
                >
                  Limpar busca
                </button>
              )}
            </motion.div>
          ) : (
            <div className="pt-1">
              {filtered.map((tenant, index) => (
                <BarbershopCard
                  key={tenant.id}
                  tenant={tenant}
                  index={index}
                  isCurrent={isTenantCurrent(tenant.id)}
                  locationGranted={locationStatus === "granted"}
                  onClick={() => {
                    const tenantSlug = tenant.slug || tenant.id;
                    const fromParam = isChangeMode ? "change" : "discover";
                    navigate(`/${tenantSlug}?from=${fromParam}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default EscolherBarbearia;
