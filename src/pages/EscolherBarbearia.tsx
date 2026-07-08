import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, SearchX, X, Map as MapIcon, Satellite, Locate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type GeocodeResult,
  buildAddressQueryFromParts,
  clearLegacyGeocodeCaches,
  geocodeAddressFromParts,
  hasPreciseAddressParts,
  normalizeLocationText as normalizeText,
  pickResolvedCoordinates,
  readCachedGeocode,
  resolveStoredCoordinates,
  saveCachedGeocode,
  shouldPreferGeocodedCoordinates,
} from "@/lib/geocoding";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoverMap } from "@/components/discover/DiscoverMap";
import { DiscoverUnitCard } from "@/components/discover/DiscoverUnitCard";
import { BottomSheet, SNAP_MID } from "@/components/discover/BottomSheet";
import { getCache, setCache } from "@/utils/cache";
import type L from "leaflet";

// ── Types ──
interface TenantJoin {
  id: string;
  nome: string;
  slug: string | null;
  slogan: string | null;
  logo_url: string | null;
  ativo: boolean;
  onboarding_completed: boolean;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  endereco_completo: string | null;
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
  tenantRua: string | null;
  tenantNumero: string | null;
  tenantBairro: string | null;
  tenantCidade: string | null;
  tenantEstado: string | null;
  tenantEnderecoCompleto: string | null;
  bannerUrl: string | null;
  distance: number | null;
  travelTime: string | null;
  travelMinutes: number | null;
  travelMode: "walking" | "driving" | null;
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

const WALKING_THRESHOLD_KM = 1.5;
const WALKING_SPEED_KMH = 4.8;
const DRIVING_SPEED_KMH = 25;
const DISCOVER_UNITS_CACHE_KEY = "discover-units:v6";
const DISCOVER_UNITS_CACHE_TTL_MINUTES = 10;
const DISCOVER_CACHE_KEYS_TO_CLEAR = ["discover-units:v1", "discover-units:v2", "discover-units:v3", "discover-units:v4", "discover-units:v5"];

function kmToMinutes(km: number, mode: "walking" | "driving"): number {
  const speed = mode === "walking" ? WALKING_SPEED_KMH : DRIVING_SPEED_KMH;
  const baseMinutes = (km / speed) * 60;
  const buffer = mode === "walking" ? 2 : 1;
  return Math.max(2, Math.round(baseMinutes) + buffer);
}

function getSmartTravelMode(km: number): "walking" | "driving" {
  return km <= WALKING_THRESHOLD_KM ? "walking" : "driving";
}

function buildAddressParts(unit: Pick<UnitData, "rua" | "numero" | "bairro" | "cidade" | "estado" | "cep" | "tenantRua" | "tenantNumero" | "tenantBairro" | "tenantCidade" | "tenantEstado">) {
  return {
    street: unit.rua?.trim() || unit.tenantRua?.trim() || null,
    number: unit.numero?.trim() || unit.tenantNumero?.trim() || null,
    neighborhood: unit.bairro?.trim() || unit.tenantBairro?.trim() || null,
    city: unit.cidade?.trim() || unit.tenantCidade?.trim() || null,
    state: unit.estado?.trim() || unit.tenantEstado?.trim() || null,
    postalCode: unit.cep?.trim() || null,
  };
}

// (Sheet logic moved to BottomSheet component)

// ── Main Page ──
const EscolherBarbearia = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [allUnits, setAllUnits] = useState<UnitData[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPreferred, setCurrentPreferred] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<"satellite" | "street">("street");
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Sheet snap state
  const [currentSheetSnap, setCurrentSheetSnap] = useState(SNAP_MID);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const isChangeMode = searchParams.get("mode") === "change";
  const isSearchMode = searchParams.get("mode") === "search";

  // ── iOS install banner ──
  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const alreadyDismissed = localStorage.getItem('installBannerDismissed');
    if (isIOS && !isStandalone && !alreadyDismissed) {
      const timer = setTimeout(() => setShowInstallBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);
  const shouldOpenCurrent = searchParams.get("open") === "current";
  const isAuthenticated = !!userId;

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

  // ── Auto-focus search when mode=search ──
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => searchInputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isSearchMode]);

  // ── Geolocation ──
  useEffect(() => {
    // In search mode, don't request geolocation immediately
    if (isSearchMode) {
      setLocationStatus("unavailable");
      return;
    }
    if (!navigator.geolocation) { setLocationStatus("unavailable"); return; }

    const getPosition = (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    const requestLocation = async () => {
      setLocationStatus("loading");
      try {
        const pos = await getPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("ready");
        return;
      } catch { /* fallback */ }
      try {
        const fallback = await getPosition({ enableHighAccuracy: false, timeout: 7000, maximumAge: 5 * 60 * 1000 });
        setUserLocation({ lat: fallback.coords.latitude, lng: fallback.coords.longitude });
        setLocationStatus("ready");
      } catch { setLocationStatus("unavailable"); }
    };
    requestLocation();
  }, [isSearchMode]);

  // ── Watch position ──
  useEffect(() => {
    if (locationStatus !== "ready" || !userLocation || !navigator.geolocation) return;
    lastLocationRef.current = userLocation;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const prev = lastLocationRef.current;
        if (!prev) return;
        const moved = haversineKm(prev.lat, prev.lng, pos.coords.latitude, pos.coords.longitude);
        if (moved > 0.5) {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          lastLocationRef.current = newLoc;
          setUserLocation(newLoc);
        }
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 60000 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [locationStatus]);

  // ── Load units ──
  const loadUnits = useCallback(async ({ preserveVisible = false }: { preserveVisible?: boolean } = {}) => {
    const cachedUnits = getCache<UnitData[]>(DISCOVER_UNITS_CACHE_KEY);
    const hasCachedUnits = Array.isArray(cachedUnits) && cachedUnits.length > 0;
    const shouldKeepVisible = preserveVisible || hasCachedUnits;

    if (hasCachedUnits && !preserveVisible) {
      setAllUnits(cachedUnits);
      setIsLoading(false);
    } else if (!shouldKeepVisible) {
      setIsLoading(true);
    }

    try {
      clearLegacyGeocodeCaches(DISCOVER_CACHE_KEYS_TO_CLEAR);

      const [{ data: units, error }, { data: barbers, error: barbersError }] = await Promise.all([
        supabase
          .from("tenant_unidades")
          .select(`id, nome, rua, numero, cep, bairro, cidade, estado, is_sede, latitude, longitude, tenant_id,
            tenant:tenants!tenant_id (id, nome, slug, slogan, logo_url, ativo, onboarding_completed, rua, numero, bairro, cidade, estado, endereco_completo)`)
          .eq("ativo", true),
        supabase
          .from("barbeiros")
          .select("id, tenant_id")
          .eq("ativo", true)
          .is("deleted_at", null),
      ]);

      if (error) {
        throw error;
      }

      let unitList: UnitData[] = (units ?? [])
        .filter((u) => {
          const t = u.tenant as unknown as TenantJoin | null;
          return t?.ativo && t?.onboarding_completed;
        })
        .map((u) => {
          const t = u.tenant as unknown as TenantJoin;
          const persistedCoords = resolveStoredCoordinates(u.latitude, u.longitude);
          const baseUnit: UnitData = {
            id: u.id,
            nome: u.nome,
            rua: u.rua,
            numero: u.numero,
            cep: u.cep,
            bairro: u.bairro,
            cidade: u.cidade,
            estado: u.estado,
            is_sede: u.is_sede ?? false,
            latitude: persistedCoords?.lat ?? null,
            longitude: persistedCoords?.lng ?? null,
            tenant_id: u.tenant_id,
            brandName: t?.nome ?? u.nome,
            brandSlug: t?.slug ?? null,
            brandLogo: t?.logo_url ?? null,
            tenantRua: t?.rua ?? null,
            tenantNumero: t?.numero ?? null,
            tenantBairro: t?.bairro ?? null,
            tenantCidade: t?.cidade ?? null,
            tenantEstado: t?.estado ?? null,
            tenantEnderecoCompleto: t?.endereco_completo ?? null,
            bannerUrl: null,
            distance: null,
            travelTime: null,
            travelMinutes: null,
            travelMode: null,
          };

          const addressParts = buildAddressParts(baseUnit);
          const addressQuery = buildAddressQueryFromParts(addressParts);
          const cachedGeocode = addressQuery
            ? readCachedGeocode(normalizeText(addressQuery))
            : null;
          const resolvedCoords = pickResolvedCoordinates(persistedCoords, cachedGeocode);

          return {
            ...baseUnit,
            latitude: resolvedCoords?.lat ?? null,
            longitude: resolvedCoords?.lng ?? null,
          };
        });

      if (barbersError) {
        console.warn("Não foi possível validar profissionais ativos; mantendo barbearias públicas visíveis.", barbersError);
      } else {
        const activeTenantIds = new Set((barbers ?? []).map((b) => b.tenant_id).filter((tid): tid is string => !!tid));
        const hasGlobalBarbers = (barbers ?? []).some((b) => !b.tenant_id);

        unitList = unitList.filter((u) => {
          const isDub = normalizeText(u.brandSlug ?? "") === "barbeariadub" || normalizeText(u.brandName) === "barbeariadub";
          if (isDub && hasGlobalBarbers) return true;
          return u.tenant_id ? activeTenantIds.has(u.tenant_id) : false;
        });
      }

      setAllUnits(unitList);
      setCache(DISCOVER_UNITS_CACHE_KEY, unitList, DISCOVER_UNITS_CACHE_TTL_MINUTES);
      setIsLoading(false);

      const tenantIds = [...new Set(unitList.map((unit) => unit.tenant_id).filter(Boolean))];
      const geocodeInFlight = new Map<string, Promise<GeocodeResult | null>>();

      const [bannerResponse, geocodedUnits] = await Promise.all([
        tenantIds.length > 0
          ? supabase.rpc("get_tenant_banners", { p_tenant_ids: tenantIds })
          : Promise.resolve({ data: [] as Array<{ tenant_id: string; banner_url: string }> | null }),
          Promise.all(
            unitList.map(async (unit) => {
              try {
                const addressParts = buildAddressParts(unit);
                if (!hasPreciseAddressParts(addressParts)) return unit;

                const addressQuery = buildAddressQueryFromParts(addressParts);
                if (!addressQuery) return unit;

                const addressKey = normalizeText(addressQuery);
                let geocodePromise = geocodeInFlight.get(addressKey);
                if (!geocodePromise) {
                  geocodePromise = geocodeAddressFromParts(addressParts);
                  geocodeInFlight.set(addressKey, geocodePromise);
                }

                const geocoded = await geocodePromise;
                if (!geocoded) return unit;

                saveCachedGeocode(addressKey, geocoded);
                const storedCoords = resolveStoredCoordinates(unit.latitude, unit.longitude);
                if (!shouldPreferGeocodedCoordinates(storedCoords, geocoded) && storedCoords) {
                  return unit;
                }

                return { ...unit, latitude: geocoded.lat, longitude: geocoded.lng };
              } catch {
                return unit;
              }
            })
          ),
      ]);

      const bannerMap = new Map<string, string>();
      (bannerResponse.data ?? []).forEach((banner: { tenant_id: string; banner_url: string }) => {
        bannerMap.set(banner.tenant_id, banner.banner_url);
      });

      const enrichedUnits = geocodedUnits.map((unit) => ({
        ...unit,
        bannerUrl: bannerMap.get(unit.tenant_id) ?? unit.bannerUrl,
      }));

      setAllUnits(enrichedUnits);
      setCache(DISCOVER_UNITS_CACHE_KEY, enrichedUnits, DISCOVER_UNITS_CACHE_TTL_MINUTES);
    } catch (err) {
      console.error("Erro inesperado ao carregar unidades:", err);
      toast.error("Erro ao carregar barbearias");
      if (!shouldKeepVisible) {
        setAllUnits([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Auth check ──
  useEffect(() => {
    const init = async () => {
      const cachedUnits = getCache<UnitData[]>(DISCOVER_UNITS_CACHE_KEY);
      const hasCachedUnits = Array.isArray(cachedUnits) && cachedUnits.length > 0;

      if (hasCachedUnits) {
        setAllUnits(cachedUnits);
        setIsLoading(false);
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setUserId(session.user.id);

        const loadPromise = loadUnits({ preserveVisible: hasCachedUnits });
        const { data: profile } = await supabase
          .from("profiles")
          .select("barbearia_preferida_id")
          .eq("id", session.user.id)
          .single();

        if (profile?.barbearia_preferida_id) {
          setCurrentPreferred(profile.barbearia_preferida_id);
        }

        await loadPromise;
        return;
      }

      if (isChangeMode) {
        navigate("/auth?mode=login");
        return;
      }

      await loadUnits({ preserveVisible: hasCachedUnits });
    };

    void init();
  }, [isChangeMode, loadUnits, navigate]);

  // ── Sort by distance ──
  const sortedUnits = useMemo(() => {
    return allUnits
      .map((u) => {
        const hasCoords = u.latitude !== null && u.longitude !== null;
        const dist = userLocation && hasCoords ? haversineKm(userLocation.lat, userLocation.lng, u.latitude!, u.longitude!) : null;
        const mode = dist !== null ? getSmartTravelMode(dist) : null;
        const minutes = dist !== null && mode !== null ? kmToMinutes(dist, mode) : null;
        return { ...u, distance: dist, travelMinutes: minutes, travelMode: mode, travelTime: minutes ? `${minutes}` : null };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [allUnits, userLocation]);

  // ── Filtered by search + map bounds ──
  const searchFilteredUnits = useMemo(() => {
    if (!search.trim()) return sortedUnits;

    const q = search.toLowerCase();
    return sortedUnits.filter(u =>
      u.nome.toLowerCase().includes(q) ||
      u.brandName.toLowerCase().includes(q) ||
      (u.bairro && u.bairro.toLowerCase().includes(q)) ||
      (u.cidade && u.cidade.toLowerCase().includes(q))
    );
  }, [sortedUnits, search]);

  const MIN_VISIBLE = 5;

  const visibleUnits = useMemo(() => {
    if (!mapReady || !mapBounds || !userLocation) return searchFilteredUnits;

    const mapCenter = mapBounds.getCenter();

    // 1. Units within current map bounds
    const inBounds = searchFilteredUnits.filter((unit) => {
      if (unit.latitude === null || unit.longitude === null) return false;
      const lat = Number.parseFloat(String(unit.latitude));
      const lng = Number.parseFloat(String(unit.longitude));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      try {
        return mapBounds.contains([lat, lng]);
      } catch {
        return true;
      }
    });

    // 2. If enough results, return sorted by distance from map center
    if (inBounds.length >= MIN_VISIBLE) {
      return inBounds.sort((a, b) => {
        const dA = haversineKm(mapCenter.lat, mapCenter.lng, a.latitude!, a.longitude!);
        const dB = haversineKm(mapCenter.lat, mapCenter.lng, b.latitude!, b.longitude!);
        return dA - dB;
      });
    }

    // 3. Not enough in bounds — always show at least MIN_VISIBLE closest to map center
    const withCoords = searchFilteredUnits.filter(
      (u) => u.latitude !== null && u.longitude !== null
    );
    const sortedByCenter = [...withCoords].sort((a, b) => {
      const dA = haversineKm(mapCenter.lat, mapCenter.lng, a.latitude!, a.longitude!);
      const dB = haversineKm(mapCenter.lat, mapCenter.lng, b.latitude!, b.longitude!);
      return dA - dB;
    });
    return sortedByCenter.slice(0, Math.max(MIN_VISIBLE, inBounds.length));
  }, [mapBounds, mapReady, searchFilteredUnits]);

  const inBoundsCount = useMemo(() => {
    if (!mapReady || !mapBounds) return visibleUnits.length;
    return visibleUnits.filter((unit) => {
      if (unit.latitude === null || unit.longitude === null) return false;
      try {
        return mapBounds.contains([Number.parseFloat(String(unit.latitude)), Number.parseFloat(String(unit.longitude))]);
      } catch { return false; }
    }).length;
  }, [visibleUnits, mapBounds, mapReady]);

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    if (!bounds.isValid()) return;
    setMapReady(true);
    setMapBounds(bounds);
  }, []);

  // ── Select unit syncs map ↔ list ──
  const handleSelectUnit = useCallback((id: string) => {
    setSelectedUnitId((prev) => (prev === id ? null : id));
    setTimeout(() => {
      const el = cardRefs.current.get(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }, []);

  const handleCardClick = useCallback((unit: UnitData) => {
    const slug = unit.brandSlug || unit.id;
    const fromParam = isChangeMode ? "change" : "discover";

    // Persist device-level signal for smart landing page
    localStorage.setItem('dub_has_barbershop', 'true');
    localStorage.setItem('dub_last_barbershop_slug', slug);
    localStorage.setItem('dub_last_barbershop_name', unit.brandName || unit.nome);

    navigate(`/${slug}?from=${fromParam}&unidade=${unit.id}`);
  }, [isChangeMode, navigate]);

  const handleRecenter = useCallback(() => {
    setSelectedUnitId(null);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'hsl(var(--background))',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* ═══ Search bar — respeita safe area do iPhone ═══ */}
      <div
        className="z-[600]"
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: 'calc(env(safe-area-inset-left, 0px) + 16px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        }}
      >
        <h1 className="sr-only">Buscar e descobrir barbearias próximas</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar barbearias..."
            aria-label="Buscar barbearias"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-12 pl-11 pr-10 rounded-full text-[14px]",
              "bg-card border border-border text-foreground",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
              "shadow-lg transition-all duration-150"
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 active:scale-90 transition-transform"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ Map — full screen behind sheet ═══ */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        {!isLoading && (
          <DiscoverMap
            units={searchFilteredUnits}
            userLocation={userLocation}
            selectedId={selectedUnitId}
            onSelectUnit={handleSelectUnit}
            onRecenter={handleRecenter}
            onBoundsChange={handleBoundsChange}
            mapStyle={mapStyle}
          />
        )}
      </div>

      {/* ═══ Map controls — float above sheet ═══ */}
      <div
        className="absolute right-3 z-[550] flex flex-col items-center gap-2"
        style={{
          bottom: `calc(${currentSheetSnap * 100}% + 1rem)`,
          transition: "bottom 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {userLocation && (
          <button
            onClick={handleRecenter}
            aria-label="Centralizar mapa na minha localização"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm transition-transform active:scale-90"
          >
            <Locate className="h-[17px] w-[17px] text-foreground" />
          </button>
        )}
        <button
          onClick={() => setMapStyle((prev) => (prev === "satellite" ? "street" : "satellite"))}
          aria-label={mapStyle === "satellite" ? "Mudar para vista de mapa" : "Mudar para vista de satélite"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm transition-transform active:scale-90"
          title={mapStyle === "satellite" ? "Ver mapa" : "Ver satélite"}
        >
          {mapStyle === "satellite" ? (
            <MapIcon className="h-[17px] w-[17px] text-foreground" />
          ) : (
            <Satellite className="h-[17px] w-[17px] text-foreground" />
          )}
        </button>
      </div>

      {/* ═══ Bottom Sheet ═══ */}
      <BottomSheet
        onSnapChange={setCurrentSheetSnap}
        header={
          <div className="px-5 pb-3 pt-1">
            <p className="text-[14px] font-semibold text-foreground text-center">
              {isLoading
                ? "Carregando..."
                : inBoundsCount >= visibleUnits.length
                  ? `${visibleUnits.length} barbearia${visibleUnits.length !== 1 ? "s" : ""} nesta área`
                  : `${visibleUnits.length} barbearia${visibleUnits.length !== 1 ? "s" : ""} mais próximas`}
            </p>
          </div>
        }
      >
        <div className="px-4 pb-8">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border/40">
                  <Skeleton className="h-28 w-full rounded-none" />
                  <div className="p-3.5 space-y-2">
                    <Skeleton className="h-4 w-36 rounded-lg" />
                    <Skeleton className="h-3 w-48 rounded-lg" />
                    <Skeleton className="h-9 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleUnits.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-16"
            >
              <SearchX className="w-8 h-8 text-muted-foreground/20 mb-3" />
              <p className="text-[15px] font-medium text-muted-foreground/50">
                Nenhuma barbearia encontrada
              </p>
              {search && (
                <button onClick={() => setSearch("")} className="mt-4 text-[12px] text-primary/60 hover:text-primary transition-colors">
                  Limpar busca
                </button>
              )}
            </motion.div>
          ) : (
            <div className="space-y-4">
              {visibleUnits.map((unit, index) => (
                <div key={unit.id} ref={(el) => { if (el) cardRefs.current.set(unit.id, el); }}>
                  <DiscoverUnitCard
                    unit={unit}
                    index={index}
                    isSelected={unit.id === selectedUnitId}
                    onClick={() => handleCardClick(unit)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ═══ iOS Install Banner ═══ */}
      {showInstallBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            left: 16,
            right: 16,
            background: 'hsl(0 0% 7%)',
            color: 'hsl(0 0% 96%)',
            borderRadius: 16,
            padding: '14px 16px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '1px solid hsl(0 0% 18%)',
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>
              Adicione à tela inicial
            </p>
            <p style={{ fontSize: 11, color: 'hsl(0 0% 64%)', margin: 0 }}>
              Toque em <span style={{ fontSize: 13 }}>↑</span> compartilhar e depois "Adicionar à Tela de Início" para tela cheia
            </p>
          </div>
          <button
            onClick={() => {
              setShowInstallBanner(false);
              localStorage.setItem('installBannerDismissed', 'true');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'hsl(0 0% 96%)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default EscolherBarbearia;
