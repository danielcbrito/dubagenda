import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, MapPin, SearchX, Navigation2, X, Footprints } from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
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
  rua: string | null;
  numero: string | null;
  cep: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_sede: boolean;
  latitude: number | null;
  longitude: number | null;
  tenant_id: string;
  brandName: string;
  brandSlug: string | null;
  brandLogo: string | null;
  distance: number | null;
  travelTime: string | null;
  travelMinutes: number | null;
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

function kmToMinutes(km: number): number {
  if (km <= 0.2) return 2;

  const averageSpeedKmH = 32;
  const trafficFactor = km < 2 ? 1.1 : km < 6 ? 1.2 : 1.3;
  const estimated = (km / averageSpeedKmH) * 60 * trafficFactor;

  return Math.max(2, Math.round(estimated));
}

function formatTravelTime(minutes: number): { value: string; unit: string } {
  if (minutes < 60) return { value: String(minutes), unit: "min" };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return { value: `${h}h`, unit: "" };
  return { value: `${h}h`, unit: `${m}min` };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

const GEOCODE_CACHE_PREFIX = "unit-geocode-v1:";
const GEOCODE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function buildAddressQuery(unit: UnitData): string | null {
  const parts = [unit.rua, unit.numero, unit.bairro, unit.cidade, unit.estado, unit.cep]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part && part.length > 0);

  if (parts.length < 3) return null;
  return parts.join(", ");
}

function readCachedGeocode(addressKey: string): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(`${GEOCODE_CACHE_PREFIX}${addressKey}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { lat?: number; lng?: number; savedAt?: number };
    const isExpired = !parsed.savedAt || Date.now() - parsed.savedAt > GEOCODE_CACHE_TTL_MS;

    if (isExpired || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") {
      localStorage.removeItem(`${GEOCODE_CACHE_PREFIX}${addressKey}`);
      return null;
    }

    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

function saveCachedGeocode(addressKey: string, lat: number, lng: number) {
  try {
    localStorage.setItem(
      `${GEOCODE_CACHE_PREFIX}${addressKey}`,
      JSON.stringify({ lat, lng, savedAt: Date.now() })
    );
  } catch {
    // ignore cache write failures
  }
}

async function geocodeAddress(addressQuery: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: addressQuery,
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Array<{ lat: string; lon: string }>;
    const hit = data[0];
    if (!hit) return null;

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// ── Skeleton Card ──
const SkeletonCard = ({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05, duration: 0.28 }}
    className="bg-card border border-border rounded-3xl py-3 px-3.5"
  >
    <div className="flex items-center gap-3">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 rounded-lg" />
        <Skeleton className="h-3 w-20 rounded-lg" />
      </div>
      <Skeleton className="w-12 h-8 rounded-2xl shrink-0" />
    </div>
  </motion.div>
);

// ── Travel Time Badge ──
const TravelTimeBadge = ({ travelTime, travelMinutes }: { travelTime: string | null; travelMinutes: number | null }) => {
  if (travelTime == null || travelMinutes == null) {
    return (
      <div className="flex flex-col items-center justify-center bg-secondary/40 border border-border/50 rounded-2xl px-2.5 py-2 min-w-[48px] shrink-0">
        <Navigation2 className="w-3.5 h-3.5 text-muted-foreground/25" />
      </div>
    );
  }

  const formatted = formatTravelTime(travelMinutes);

  return (
    <div className="flex flex-col items-center justify-center bg-success/10 border border-success/20 rounded-2xl px-2.5 py-2 min-w-[48px] shrink-0 gap-0.5">
      <Car className="w-[11px] h-[11px] text-success" />
      <span className="text-[17px] font-bold text-success leading-none font-mono tabular-nums">
        {formatted.value}
      </span>
      {formatted.unit && (
        <span className="text-[8px] text-muted-foreground/60 uppercase font-mono">
          {formatted.unit}
        </span>
      )}
    </div>
  );
};

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
  const subtitle = [unit.bairro, unit.cidade].filter(Boolean).join(", ");
  const showUnitName = unit.nome !== unit.brandName;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={onClick}
      className={cn(
        "w-full text-left bg-card border border-border rounded-3xl py-3 px-3.5",
        "active:scale-[0.975] active:border-primary/20",
        "transition-all duration-[130ms] ease-out"
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-border/60">
          {logoUrl ? (
            <img src={logoUrl} alt={unit.brandName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary border border-border">
              <span className="text-[18px] font-bold text-muted-foreground/50">
                {brandInitial}
              </span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <span className="text-[14px] font-semibold text-foreground leading-tight line-clamp-1 block">
            {unit.brandName}
          </span>

          {showUnitName && (
            <p className="text-[12px] text-muted-foreground/60 leading-tight line-clamp-1 mt-0.5">
              {unit.nome}
            </p>
          )}

          {subtitle && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-[10px] h-[10px] text-muted-foreground/35 shrink-0" />
              <span className="text-[11px] text-muted-foreground/50 line-clamp-1">
                {subtitle}
              </span>
            </div>
          )}
        </div>

        {/* Travel Time Badge */}
        <TravelTimeBadge travelTime={unit.travelTime} travelMinutes={unit.travelMinutes} />
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
  const [locationStatus, setLocationStatus] = useState<"loading" | "ready" | "unavailable">("loading");
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
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    const getPosition = (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    const requestLocation = async () => {
      setLocationStatus("loading");

      try {
        const highAccuracy = await getPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });

        setUserLocation({
          lat: highAccuracy.coords.latitude,
          lng: highAccuracy.coords.longitude,
        });
        setLocationStatus("ready");
        return;
      } catch {
        // tenta fallback mais rápido com cache recente
      }

      try {
        const fallback = await getPosition({
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 5 * 60 * 1000,
        });

        setUserLocation({ lat: fallback.coords.latitude, lng: fallback.coords.longitude });
        setLocationStatus("ready");
      } catch {
        setLocationStatus("unavailable");
      }
    };

    requestLocation();
  }, []);

  // ── Load units ──
  const loadUnits = async () => {
    setIsLoading(true);

    const { data: units, error } = await supabase
      .from("tenant_unidades")
      .select(`
        id, nome, rua, numero, cep, bairro, cidade, estado, is_sede, latitude, longitude, tenant_id,
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

    let unitList: UnitData[] = (units ?? [])
      .filter((u) => {
        const t = u.tenant as unknown as TenantJoin | null;
        return t?.ativo && t?.onboarding_completed;
      })
      .map((u) => {
        const t = u.tenant as unknown as TenantJoin;
        return {
          id: u.id,
          nome: u.nome,
          rua: u.rua,
          numero: u.numero,
          cep: u.cep,
          bairro: u.bairro,
          cidade: u.cidade,
          estado: u.estado,
          is_sede: u.is_sede ?? false,
          latitude: u.latitude,
          longitude: u.longitude,
          tenant_id: u.tenant_id,
          brandName: t?.nome ?? u.nome,
          brandSlug: t?.slug ?? null,
          brandLogo: t?.logo_url ?? null,
          distance: null,
          travelTime: null,
          travelMinutes: null,
        };
      });

    // Filter units whose tenant has active barbers
    const { data: barbers } = await supabase
      .from("barbeiros")
      .select("id, tenant_id")
      .eq("ativo", true)
      .is("deleted_at", null);

    const activeTenantIds = new Set(
      (barbers ?? []).map((b) => b.tenant_id).filter((tid): tid is string => !!tid)
    );
    const hasGlobalBarbers = (barbers ?? []).some((b) => !b.tenant_id);

    unitList = unitList.filter((u) => {
      const isDub =
        normalizeText(u.brandSlug ?? "") === "barbeariadub" ||
        normalizeText(u.brandName) === "barbeariadub";

      if (isDub && hasGlobalBarbers) return true;
      return u.tenant_id ? activeTenantIds.has(u.tenant_id) : false;
    });

    const geocodeInFlight = new Map<string, Promise<{ lat: number; lng: number } | null>>();

    unitList = await Promise.all(
      unitList.map(async (unit) => {
        const addressQuery = buildAddressQuery(unit);
        if (!addressQuery) return unit;

        const addressKey = normalizeText(addressQuery);
        const cached = readCachedGeocode(addressKey);
        if (cached) {
          return { ...unit, latitude: cached.lat, longitude: cached.lng };
        }

        let geocodePromise = geocodeInFlight.get(addressKey);
        if (!geocodePromise) {
          geocodePromise = geocodeAddress(addressQuery);
          geocodeInFlight.set(addressKey, geocodePromise);
        }

        const geocoded = await geocodePromise;
        if (!geocoded) return unit;

        saveCachedGeocode(addressKey, geocoded.lat, geocoded.lng);
        return { ...unit, latitude: geocoded.lat, longitude: geocoded.lng };
      })
    );

    setAllUnits(unitList);
    setIsLoading(false);
  };

  // ── Sort by distance + compute travel time ──
  const sortedUnits = useMemo(() => {
    const withDist = allUnits.map((u) => {
      const hasCoordinates = u.latitude !== null && u.longitude !== null;
      const dist = userLocation && hasCoordinates
        ? haversineKm(userLocation.lat, userLocation.lng, u.latitude, u.longitude)
        : null;
      const minutes = dist !== null ? kmToMinutes(dist) : null;
      const formatted = minutes !== null ? formatTravelTime(minutes) : null;
      const time = formatted ? `${formatted.value} ${formatted.unit}`.trim() : null;

      return {
        ...u,
        distance: dist,
        travelMinutes: minutes,
        travelTime: time,
      };
    });

    return withDist.sort((a, b) => {
      const dA = a.distance ?? Infinity;
      const dB = b.distance ?? Infinity;
      return dA - dB;
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

  const handleBack = () => navigate(isChangeMode ? "/cliente/perfil" : "/");

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ══════ Header ══════ */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={handleBack}
            className="active:scale-[0.92] transition-transform duration-100 text-foreground shrink-0"
          >
            <BackArrow size={22} />
          </button>
          <h1 className="text-[26px] font-bold text-foreground leading-tight">Barbearias</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Buscar por nome ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-12 pl-10 pr-10 rounded-2xl text-[14px]",
              "bg-secondary/30 border border-border text-foreground",
              "placeholder:text-muted-foreground/35",
              "focus:outline-none focus:border-primary/30",
              "transition-colors duration-150"
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 active:scale-90 transition-transform"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {locationStatus === "unavailable" && (
          <p className="text-[11px] text-muted-foreground/70 mt-2 px-1">
            Ative sua localização para calcular o tempo exato até cada barbearia.
          </p>
        )}
      </div>

      {/* ══════ Scrollable list ══════ */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-5 pb-8">
          {isLoading ? (
            <div className="flex flex-col gap-2.5 pt-1">
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
              <p className="text-[15px] font-medium text-muted-foreground/50">
                Nenhuma barbearia encontrada
              </p>
              <p className="text-[13px] text-muted-foreground/35 mt-1">
                Tente outro nome ou bairro
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-4 text-[12px] text-primary/60 hover:text-primary transition-colors"
                >
                  Limpar busca
                </button>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2.5 pt-1">
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
