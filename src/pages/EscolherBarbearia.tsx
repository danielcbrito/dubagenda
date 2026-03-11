import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ChevronRight, MapPin, ArrowLeft, SearchX, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──
interface TenantJoin {
  id: string;
  nome: string;
  slug: string | null;
  slogan: string | null;
  logo_url: string | null;
  ativo: boolean;
  onboarding_completed: boolean;
}

interface UnitData {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_sede: boolean;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  slogan: string | null;
  tenant_id: string;
  brandName: string;
  brandSlug: string | null;
  brandLogo: string | null;
  distance: number | null;
  avgRating: number | null;
  totalReviews: number;
}

// ── Utils ──
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

// ── Skeleton Card ──
const SkeletonCard = ({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06, duration: 0.3 }}
    className="bg-card border border-border rounded-3xl p-4"
  >
    <div className="flex items-center gap-3.5">
      <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36 rounded-lg" />
        <Skeleton className="h-3 w-24 rounded-lg" />
        <Skeleton className="h-3 w-16 rounded-full mt-1" />
      </div>
    </div>
  </motion.div>
);

// ── Unit Card ──
const UnitCard = ({
  unit,
  index,
  onClick,
}: {
  unit: UnitData;
  index: number;
  onClick: () => void;
}) => {
  const logoUrl = unit.brandLogo;
  const brandInitial = unit.brandName?.[0]?.toUpperCase() ?? "?";
  const hasRating = unit.avgRating != null && unit.totalReviews > 0;

  const subtitle = [unit.bairro, unit.cidade].filter(Boolean).join(", ");

  const showUnitName = unit.nome !== unit.brandName;

  const distanceText = unit.distance != null
    ? unit.distance < 1
      ? `● ${Math.round(unit.distance * 1000)}m de você`
      : `● ${unit.distance.toFixed(1)}km de você`
    : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={onClick}
      className={cn(
        "w-full text-left bg-card border border-border rounded-3xl p-4",
        "active:scale-[0.97] active:border-primary/20",
        "transition-all duration-150"
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="flex items-center gap-3.5">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl shrink-0 overflow-hidden border border-border/60">
          {logoUrl ? (
            <img src={logoUrl} alt={unit.brandName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary border border-border">
              <span className="text-[20px] font-bold text-muted-foreground font-mono">
                {brandInitial}
              </span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {/* Brand name + badges */}
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground leading-tight line-clamp-1">
              {unit.brandName}
            </span>
            {unit.is_sede && (
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] bg-primary/10 text-primary border border-primary/20 rounded-full px-1.5 py-0.5 shrink-0 font-mono">
                Sede
              </span>
            )}
            {hasRating && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Star className="w-[10px] h-[10px] fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-medium tabular-nums text-foreground/60">
                  {unit.avgRating!.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          {/* Unit name (if different from brand) */}
          {showUnitName && (
            <p className="text-[12px] text-muted-foreground/70 leading-tight line-clamp-1 mt-0.5">
              {unit.nome}
            </p>
          )}

          {/* Location */}
          {subtitle && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-[11px] h-[11px] text-muted-foreground/50 shrink-0" />
              <span className="text-[12px] text-muted-foreground/70 line-clamp-1">
                {subtitle}
              </span>
            </div>
          )}

          {/* Distance badge */}
          {distanceText && (
            <span className="inline-block mt-1.5 text-[10px] font-mono text-primary/80 bg-primary/8 border border-primary/15 rounded-full px-2 py-0.5">
              {distanceText}
            </span>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
      </div>
    </motion.button>
  );
};

// ── Main Page ──
const EscolherBarbearia = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [allUnits, setAllUnits] = useState<UnitData[]>([]);
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
      await loadUnits();
    };
    init();
  }, []);

  // ── Auto-open ──
  useEffect(() => {
    if (!shouldOpenCurrent || isLoading || hasAutoOpened) return;
    setHasAutoOpened(true);
    const target = currentPreferred
      ? allUnits.find(u => u.tenant_id === currentPreferred)
      : allUnits.find(u => normalizeText(u.brandName) === "barbeariadub");
    if (target) {
      const slug = target.brandSlug || target.id;
      navigate(`/${slug}?from=${isChangeMode ? "change" : "discover"}`, { replace: true });
    }
  }, [shouldOpenCurrent, isLoading, hasAutoOpened, currentPreferred, allUnits]);

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

  // ── Load units ──
  const loadUnits = async () => {
    setIsLoading(true);

    const { data: units, error } = await supabase
      .from("tenant_unidades")
      .select(`
        id, nome, bairro, cidade, estado, is_sede, latitude, longitude, logo_url, slogan, tenant_id,
        tenant:tenants!tenant_id (
          id, nome, slug, slogan, logo_url, ativo, onboarding_completed
        )
      `)
      .eq("ativo", true);

    if (error) {
      console.error("Erro ao carregar unidades:", error);
      toast.error("Erro ao carregar barbearias");
      setAllUnits([]);
      setIsLoading(false);
      return;
    }

    // Filter active+onboarded tenants, map to UnitData
    let unitList: UnitData[] = (units ?? [])
      .filter(u => {
        const t = u.tenant as unknown as TenantJoin | null;
        return t?.ativo && t?.onboarding_completed;
      })
      .map(u => {
        const t = u.tenant as unknown as TenantJoin;
        return {
          id: u.id,
          nome: u.nome,
          bairro: u.bairro,
          cidade: u.cidade,
          estado: u.estado,
          is_sede: u.is_sede ?? false,
          latitude: u.latitude,
          longitude: u.longitude,
          logo_url: u.logo_url,
          slogan: u.slogan,
          tenant_id: u.tenant_id,
          // BUG 1 FIX: logo comes from brand (tenant), NEVER from another brand
          brandName: t?.nome ?? u.nome,
          brandSlug: t?.slug ?? null,
          brandLogo: t?.logo_url ?? null,
          distance: null,
          avgRating: null,
          totalReviews: 0,
        };
      });

    // Filter units whose tenant has active barbers
    const { data: barbers } = await supabase
      .from("barbeiros")
      .select("id, tenant_id")
      .eq("ativo", true)
      .is("deleted_at", null);

    const activeTenantIds = new Set(
      (barbers ?? []).map(b => b.tenant_id).filter((tid): tid is string => !!tid)
    );
    const hasGlobalBarbers = (barbers ?? []).some(b => !b.tenant_id);

    unitList = unitList.filter(u => {
      const isDub = normalizeText(u.brandSlug ?? "") === "barbeariadub" || normalizeText(u.brandName) === "barbeariadub";
      if (isDub && hasGlobalBarbers) return true;
      return u.tenant_id ? activeTenantIds.has(u.tenant_id) : false;
    });

    // Load ratings per tenant
    if (barbers && barbers.length > 0) {
      const barberIds = barbers.map(b => b.id);
      const { data: reviews } = await supabase
        .from("barbeiro_avaliacoes")
        .select("barber_id, rating")
        .in("barber_id", barberIds);

      if (reviews && reviews.length > 0) {
        const barberToTenant = new Map(barbers.map(b => [b.id, b.tenant_id]));
        const tenantRatings = new Map<string, { sum: number; count: number }>();

        for (const r of reviews) {
          const tid = barberToTenant.get(r.barber_id);
          if (!tid) continue;
          const cur = tenantRatings.get(tid) || { sum: 0, count: 0 };
          cur.sum += r.rating;
          cur.count += 1;
          tenantRatings.set(tid, cur);
        }

        for (const u of unitList) {
          const stats = tenantRatings.get(u.tenant_id);
          if (stats) {
            u.avgRating = stats.sum / stats.count;
            u.totalReviews = stats.count;
          }
        }
      }
    }

    setAllUnits(unitList);
    setIsLoading(false);
  };

  // ── Sort by distance (BUG 2 FIX: per-unit coordinates) ──
  const sortedUnits = useMemo(() => {
    const withDist = allUnits.map(u => ({
      ...u,
      distance: userLocation && u.latitude && u.longitude
        ? haversineKm(userLocation.lat, userLocation.lng, u.latitude, u.longitude)
        : null,
    }));

    return withDist.sort((a, b) => {
      const dA = a.distance ?? Infinity;
      const dB = b.distance ?? Infinity;
      if (dA !== dB) return dA - dB;
      const rA = a.avgRating ?? 0;
      const rB = b.avgRating ?? 0;
      if (rA !== rB) return rB - rA;
      return (b.totalReviews ?? 0) - (a.totalReviews ?? 0);
    });
  }, [allUnits, userLocation]);

  // ── Filtered ──
  const filtered = useMemo(() => {
    if (!search.trim()) return sortedUnits;
    const q = search.toLowerCase();
    return sortedUnits.filter(u =>
      u.nome.toLowerCase().includes(q) ||
      u.brandName.toLowerCase().includes(q) ||
      (u.bairro && u.bairro.toLowerCase().includes(q)) ||
      (u.cidade && u.cidade.toLowerCase().includes(q))
    );
  }, [sortedUnits, search]);

  // ── Handlers ──
  const handleSelect = async (unitId: string) => {
    if (saving) return;
    const unit = allUnits.find(u => u.id === unitId);
    const tenantId = unit?.tenant_id || unitId;
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&origin=discover&tenant=${tenantId}`);
      return;
    }
    setSaving(unitId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          barbearia_preferida_id: tenantId,
          signup_origin: "discover",
        })
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

  const totalCount = filtered.length;

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ══════ Header ══════ */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/60 border border-border/50 backdrop-blur-sm active:scale-90 transition-transform text-foreground"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          <div>
            <p className="text-[10px] font-mono text-primary/80 tracking-[0.2em] uppercase mb-0.5">
              {isChangeMode ? "TROCAR BARBEARIA" : "ENCONTRE SEU ESTILO"}
            </p>
            {!isLoading && (
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[13px] text-muted-foreground">
                  {totalCount} {totalCount === 1 ? "unidade" : "unidades"} perto de você
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar barbearia ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-12 pl-10 pr-4 rounded-2xl text-[14px]",
              "bg-secondary/40 border border-border text-foreground",
              "placeholder:text-muted-foreground/40",
              "focus:outline-none focus:border-primary/40",
              "transition-colors duration-150"
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

        <div className="h-full overflow-y-auto overscroll-contain px-5 pb-8">
          {isLoading ? (
            <div className="flex flex-col gap-3 pt-1">
              {[0, 1, 2, 3].map(i => (
                <SkeletonCard key={i} index={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-16"
            >
              <SearchX className="w-8 h-8 text-muted-foreground/20 mb-3" />
              <p className="text-[15px] font-medium text-muted-foreground">
                Nenhuma unidade encontrada
              </p>
              <p className="text-[13px] text-muted-foreground/50 mt-1">
                Tente buscar por outro nome ou bairro
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-3 text-[12px] text-primary/60 hover:text-primary transition-colors"
                >
                  Limpar busca
                </button>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              {filtered.map((unit, index) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  index={index}
                  onClick={() => {
                    const slug = unit.brandSlug || unit.id;
                    const fromParam = isChangeMode ? "change" : "discover";
                    const unidadeParam = unit.is_sede ? "" : `&unidade=${unit.id}`;
                    navigate(`/${slug}?from=${fromParam}${unidadeParam}`);
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
