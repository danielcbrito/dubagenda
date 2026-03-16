import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, SearchX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoverMap } from "@/components/discover/DiscoverMap";
import { DiscoverUnitCard } from "@/components/discover/DiscoverUnitCard";
import { getDiscoverUnitDisplayName } from "@/components/discover/discoverUnitUtils";
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

function kmToMinutes(km: number, mode: "walking" | "driving"): number {
  const speed = mode === "walking" ? WALKING_SPEED_KMH : DRIVING_SPEED_KMH;
  const baseMinutes = (km / speed) * 60;
  const buffer = mode === "walking" ? 2 : 1;
  return Math.max(2, Math.round(baseMinutes) + buffer);
}

function getSmartTravelMode(km: number): "walking" | "driving" {
  return km <= WALKING_THRESHOLD_KM ? "walking" : "driving";
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
  const parts = [unit.rua, unit.numero, unit.bairro, unit.cidade, unit.estado, unit.cep, "Brasil"]
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
  } catch { /* ignore */ }
}

async function geocodeAddress(addressQuery: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: addressQuery, format: "jsonv2", limit: "1", countrycodes: "br",
  });
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: controller.signal, headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Array<{ lat: string; lon: string }>;
    const hit = data[0];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch { return null; } finally { window.clearTimeout(timeoutId); }
}

// ── Draggable sheet constants ──
const SHEET_SNAP_TOP = 0.3; // 30% from top = 70% sheet
const SHEET_SNAP_MID = 0.55; // 55% from top = 45% sheet
const SHEET_SNAP_BOTTOM = 0.85; // 85% from top = 15% sheet (collapsed)

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
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Sheet drag state
  const [sheetTop, setSheetTop] = useState(SHEET_SNAP_MID);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartTop = useRef(0);

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
  }, []);

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
  const loadUnits = async () => {
    setIsLoading(true);
    try {
      const { data: units, error } = await supabase
        .from("tenant_unidades")
        .select(`id, nome, rua, numero, cep, bairro, cidade, estado, is_sede, latitude, longitude, tenant_id,
          tenant:tenants!tenant_id (id, nome, slug, slogan, logo_url, ativo, onboarding_completed)`)
        .eq("ativo", true);

      if (error) {
        console.error("Erro ao carregar unidades:", error);
        toast.error("Erro ao carregar barbearias");
        setAllUnits([]); setIsLoading(false); return;
      }

      let unitList: UnitData[] = (units ?? [])
        .filter((u) => { const t = u.tenant as unknown as TenantJoin | null; return t?.ativo && t?.onboarding_completed; })
        .map((u) => {
          const t = u.tenant as unknown as TenantJoin;
          return {
            id: u.id, nome: u.nome, rua: u.rua, numero: u.numero, cep: u.cep,
            bairro: u.bairro, cidade: u.cidade, estado: u.estado,
            is_sede: u.is_sede ?? false, latitude: u.latitude, longitude: u.longitude,
            tenant_id: u.tenant_id, brandName: t?.nome ?? u.nome,
            brandSlug: t?.slug ?? null, brandLogo: t?.logo_url ?? null,
            distance: null, travelTime: null, travelMinutes: null, travelMode: null,
          };
        });

      // Filter by active barbers
      const { data: barbers } = await supabase
        .from("barbeiros").select("id, tenant_id").eq("ativo", true).is("deleted_at", null);
      const activeTenantIds = new Set((barbers ?? []).map((b) => b.tenant_id).filter((tid): tid is string => !!tid));
      const hasGlobalBarbers = (barbers ?? []).some((b) => !b.tenant_id);
      unitList = unitList.filter((u) => {
        const isDub = normalizeText(u.brandSlug ?? "") === "barbeariadub" || normalizeText(u.brandName) === "barbeariadub";
        if (isDub && hasGlobalBarbers) return true;
        return u.tenant_id ? activeTenantIds.has(u.tenant_id) : false;
      });

      // Geocode missing coordinates
      const geocodeInFlight = new Map<string, Promise<{ lat: number; lng: number } | null>>();
      unitList = await Promise.all(
        unitList.map(async (unit) => {
          try {
            if (unit.latitude !== null && unit.longitude !== null) return unit;
            const addressQuery = buildAddressQuery(unit);
            if (!addressQuery) return unit;
            const addressKey = normalizeText(addressQuery);
            const cached = readCachedGeocode(addressKey);
            if (cached) return { ...unit, latitude: cached.lat, longitude: cached.lng };
            let geocodePromise = geocodeInFlight.get(addressKey);
            if (!geocodePromise) { geocodePromise = geocodeAddress(addressQuery); geocodeInFlight.set(addressKey, geocodePromise); }
            const geocoded = await geocodePromise;
            if (!geocoded) return unit;
            saveCachedGeocode(addressKey, geocoded.lat, geocoded.lng);
            return { ...unit, latitude: geocoded.lat, longitude: geocoded.lng };
          } catch {
            return unit;
          }
        })
      );

      setAllUnits(unitList);
    } catch (err) {
      console.error("Erro inesperado ao carregar unidades:", err);
      toast.error("Erro ao carregar barbearias");
      setAllUnits([]);
    } finally {
      setIsLoading(false);
    }
  };

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
    if (!mapReady || !mapBounds) return searchFilteredUnits;

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

  // Clear stale geocode cache on mount to use fresh DB coordinates
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(GEOCODE_CACHE_PREFIX)) keysToRemove.push(key);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }, []);

  // ── Select unit syncs map ↔ list ──
  const handleSelectUnit = useCallback((id: string) => {
    setSelectedUnitId((prev) => (prev === id ? null : id));
    // Scroll card into view
    setTimeout(() => {
      const el = cardRefs.current.get(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
    // Expand sheet if collapsed
    if (sheetTop > SHEET_SNAP_MID) setSheetTop(SHEET_SNAP_MID);
  }, [sheetTop]);

  const handleCardClick = useCallback((unit: UnitData) => {
    const slug = unit.brandSlug || unit.id;
    const fromParam = isChangeMode ? "change" : "discover";
    const unidadeParam = unit.is_sede ? "" : `&unidade=${unit.id}`;
    navigate(`/${slug}?from=${fromParam}${unidadeParam}`);
  }, [isChangeMode, navigate]);

  const handleRecenter = useCallback(() => {
    setSelectedUnitId(null);
  }, []);

  // ── Sheet drag handlers ──
  const handleDragStart = useCallback((clientY: number) => {
    isDragging.current = true;
    dragStartY.current = clientY;
    dragStartTop.current = sheetTop;
  }, [sheetTop]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging.current) return;
    const vh = window.innerHeight;
    const deltaRatio = (clientY - dragStartY.current) / vh;
    const newTop = Math.max(SHEET_SNAP_TOP, Math.min(SHEET_SNAP_BOTTOM, dragStartTop.current + deltaRatio));
    setSheetTop(newTop);
  }, []);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    // Snap to closest
    const snaps = [SHEET_SNAP_TOP, SHEET_SNAP_MID, SHEET_SNAP_BOTTOM];
    const closest = snaps.reduce((prev, curr) =>
      Math.abs(curr - sheetTop) < Math.abs(prev - sheetTop) ? curr : prev
    );
    setSheetTop(closest);
  }, [sheetTop]);

  return (
    <div className="relative bg-background" style={{ height: "100dvh", overflow: "hidden" }}>
      {/* ═══ Search bar ═══ */}
      <div className="absolute top-0 left-0 right-0 z-[600] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Buscar barbearias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-12 pl-11 pr-10 rounded-full text-[14px]",
              "bg-card border border-border text-foreground",
              "placeholder:text-muted-foreground/40",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
              "shadow-lg transition-all duration-150"
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 active:scale-90 transition-transform"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ Map ═══ */}
      <div className="absolute inset-0" style={{ height: `${sheetTop * 100}%` }}>
        {!isLoading && (
          <DiscoverMap
            units={searchFilteredUnits}
            userLocation={userLocation}
            selectedId={selectedUnitId}
            onSelectUnit={handleSelectUnit}
            onRecenter={handleRecenter}
            onBoundsChange={handleBoundsChange}
          />
        )}
      </div>

      {/* ═══ Draggable sheet ═══ */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[500] bg-background rounded-t-[20px] border-t border-border/50 shadow-[0_-4px_30px_rgba(0,0,0,0.15)] flex flex-col"
        style={{
          top: `${sheetTop * 100}%`,
          transition: isDragging.current ? "none" : "top 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Handle */}
        <div
          className="flex-shrink-0 flex items-center justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => {
            handleDragStart(e.clientY);
            const moveHandler = (ev: MouseEvent) => handleDragMove(ev.clientY);
            const upHandler = () => { handleDragEnd(); window.removeEventListener("mousemove", moveHandler); window.removeEventListener("mouseup", upHandler); };
            window.addEventListener("mousemove", moveHandler);
            window.addEventListener("mouseup", upHandler);
          }}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Count */}
        <div className="flex-shrink-0 px-5 pb-3 pt-1">
          <p className="text-[14px] font-semibold text-foreground text-center">
            {isLoading
              ? "Carregando..."
              : inBoundsCount >= visibleUnits.length
                ? `${visibleUnits.length} barbearia${visibleUnits.length !== 1 ? "s" : ""} nesta área`
                : `${visibleUnits.length} barbearia${visibleUnits.length !== 1 ? "s" : ""} mais próximas`}
          </p>
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop > 30 && sheetTop > SHEET_SNAP_TOP) {
              setSheetTop(SHEET_SNAP_TOP);
            }
          }}
        >
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
      </div>
    </div>
  );
};

export default EscolherBarbearia;
