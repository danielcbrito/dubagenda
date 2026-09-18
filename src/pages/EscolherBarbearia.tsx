import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, SearchX, X, Map as MapIcon, Satellite, Locate, List, MapPin } from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
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
import { DiscoverUnitCard, type BarberSummary } from "@/components/discover/DiscoverUnitCard";
import { BottomSheet, type BottomSheetRef, SNAP_MID, SNAP_FULL, SNAP_PEEK } from "@/components/discover/BottomSheet";
import { getCache, setCache } from "@/utils/cache";
import { getVerifiedAuthUser } from "@/utils/authSession";
import type L from "leaflet";
import logoDub from "@/assets/logo-dub.png";
import { setStatusBarTheme } from "@/utils/statusBar";

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
  barbers?: BarberSummary[];
  barbersCount?: number;
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

  // Carousel scroll ref & mouse drag handlers
  const carouselRef = useRef<HTMLDivElement>(null);
  const isDraggingCarousel = useRef(false);
  const carouselStartX = useRef(0);
  const carouselScrollLeft = useRef(0);

  const handleCarouselMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingCarousel.current = true;
    carouselStartX.current = e.pageX - (carouselRef.current?.offsetLeft || 0);
    carouselScrollLeft.current = carouselRef.current?.scrollLeft || 0;
  };

  const handleCarouselMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCarousel.current || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - (carouselRef.current.offsetLeft || 0);
    const walk = (x - carouselStartX.current) * 1.5;
    carouselRef.current.scrollLeft = carouselScrollLeft.current - walk;
  };

  const handleCarouselMouseUp = () => {
    isDraggingCarousel.current = false;
  };

  const handleCarouselWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (carouselRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      carouselRef.current.scrollLeft += e.deltaY;
    }
  };

  // Sheet snap state
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [currentSheetSnap, setCurrentSheetSnap] = useState(SNAP_MID);
  const isFullSnap = currentSheetSnap >= 0.85;
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("near");
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const handleListScroll = useCallback((scrollTop: number) => {
    setIsScrolled((prev) => {
      if (scrollTop > 35 && !prev) return true;
      if (scrollTop <= 10 && prev) return false;
      return prev;
    });
  }, []);

  const dubUnit = useMemo(() => {
    return allUnits.find(
      (u) => normalizeText(u.brandSlug ?? "") === "barbeariadub" || normalizeText(u.brandName) === "barbeariadub"
    );
  }, [allUnits]);

  const dubLogo = dubUnit?.brandLogo || "/barbearia-dub-logo.png";

  const isChangeMode = searchParams.get("mode") === "change";
  const isSearchMode = searchParams.get("mode") === "search";
  const isInviteMode = searchParams.get("mode") === "invite";
  const inviteRef = searchParams.get("ref") || "";

  // ── Immersive Status Bar (o mapa sangra 100% até o topo por trás do relógio e bateria) ──
  useEffect(() => {
    document.documentElement.classList.add("immersive-active", "immersive-map-active");
    document.documentElement.style.backgroundColor = "#000000";
    document.documentElement.style.colorScheme = "dark";
    if (document.body) {
      document.body.style.backgroundColor = "#000000";
      document.body.style.colorScheme = "dark";
    }

    setStatusBarTheme("#000000", "black-translucent");

    return () => {
      document.documentElement.classList.remove("immersive-active", "immersive-map-active");
      document.documentElement.style.backgroundColor = "#FFFFFF";
      document.documentElement.style.colorScheme = "light";
      if (document.body) {
        document.body.style.backgroundColor = "#FFFFFF";
        document.body.style.colorScheme = "light";
      }
      setStatusBarTheme("#FFFFFF", "default");
    };
  }, []);

  // Sincroniza a barra de status conforme o bottom sheet abre ou fecha (#000000 quando o mapa está visível, #FFFFFF em tela cheia)
  useEffect(() => {
    const isFull = currentSheetSnap >= 0.85;
    const targetColor = isFull ? "#FFFFFF" : "#000000";
    const targetStyle = isFull ? "default" : "black-translucent";
    const targetScheme = isFull ? "light" : "dark";

    document.documentElement.style.backgroundColor = targetColor;
    document.documentElement.style.colorScheme = targetScheme;
    if (document.body) {
      document.body.style.backgroundColor = targetColor;
      document.body.style.colorScheme = targetScheme;
    }
    if (isFull) {
      document.documentElement.classList.remove("immersive-map-active");
    } else {
      document.documentElement.classList.add("immersive-map-active");
    }
    setStatusBarTheme(targetColor, targetStyle);
  }, [currentSheetSnap]);

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
          .select("id, tenant_id, apelido, foto_url")
          .eq("ativo", true)
          .is("deleted_at", null)
          .order("apelido"),
      ]);

      if (error) {
        throw error;
      }

      const barbersByTenant = new Map<string, BarberSummary[]>();
      const globalBarbers: BarberSummary[] = [];

      (barbers ?? []).forEach((b) => {
        const item: BarberSummary = {
          id: b.id,
          apelido: b.apelido,
          foto_url: b.foto_url,
        };
        if (b.tenant_id) {
          const list = barbersByTenant.get(b.tenant_id) ?? [];
          list.push(item);
          barbersByTenant.set(b.tenant_id, list);
        } else {
          globalBarbers.push(item);
        }
      });

      let unitList: UnitData[] = (units ?? [])
        .filter((u) => {
          const t = u.tenant as unknown as TenantJoin | null;
          return t?.ativo && t?.onboarding_completed;
        })
        .map((u) => {
          const t = u.tenant as unknown as TenantJoin;
          const persistedCoords = resolveStoredCoordinates(u.latitude, u.longitude);
          const isDub = normalizeText(t?.slug ?? "") === "barbeariadub" || normalizeText(t?.nome ?? "") === "barbeariadub";
          const tenantBarbers = u.tenant_id ? (barbersByTenant.get(u.tenant_id) ?? []) : [];
          const unitBarbers = (isDub && tenantBarbers.length === 0) ? globalBarbers : tenantBarbers;

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
            barbers: unitBarbers,
            barbersCount: unitBarbers.length,
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

      const user = await getVerifiedAuthUser();

      if (user) {
        setUserId(user.id);

        const loadPromise = loadUnits({ preserveVisible: hasCachedUnits });
        const { data: profile } = await supabase
          .from("profiles")
          .select("barbearia_preferida_id")
          .eq("id", user.id)
          .maybeSingle();

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

  // ── Realtime: novas barbearias aparecem sem refresh ──
  useEffect(() => {
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        void loadUnits({ preserveVisible: true });
      }, 400);
    };

    const channel = supabase
      .channel("discover-units-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_unidades" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "tenants" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "barbeiros" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [loadUnits]);

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

  // ── Filtered by activeFilter + search + map bounds ──
  const searchFilteredUnits = useMemo(() => {
    let list = sortedUnits;

    if (activeFilter === "dub") {
      list = list.filter((u) =>
        (u.brandSlug ?? "").toLowerCase().includes("dub") ||
        u.brandName.toLowerCase().includes("dub") ||
        u.nome.toLowerCase().includes("dub")
      );
    } else if (activeFilter === "top") {
      list = [...list].sort((a, b) => (b.is_sede ? 1 : 0) - (a.is_sede ? 1 : 0));
    } else if (activeFilter === "sede") {
      list = list.filter((u) => u.is_sede);
    } else if (activeFilter === "walking") {
      list = list.filter((u) => u.distance !== null && u.distance <= 1.5);
    }

    if (!search.trim()) return list;

    const q = search.toLowerCase();
    return list.filter((u) =>
      u.nome.toLowerCase().includes(q) ||
      u.brandName.toLowerCase().includes(q) ||
      (u.bairro && u.bairro.toLowerCase().includes(q)) ||
      (u.cidade && u.cidade.toLowerCase().includes(q)) ||
      (u.barbers && u.barbers.some((b) => b.apelido.toLowerCase().includes(q)))
    );
  }, [sortedUnits, activeFilter, search]);

  const MIN_VISIBLE = 5;

  const visibleUnits = useMemo(() => {
    if (!mapReady || !mapBounds || !userLocation) return searchFilteredUnits;

    const mapCenter = mapBounds.getCenter();

    const withCoords = searchFilteredUnits.filter(
      (u) => u.latitude !== null && u.longitude !== null
    );
    const withoutCoords = searchFilteredUnits.filter(
      (u) => u.latitude === null || u.longitude === null
    );

    // 1. Units within current map bounds
    const inBounds = withCoords.filter((unit) => {
      const lat = Number.parseFloat(String(unit.latitude));
      const lng = Number.parseFloat(String(unit.longitude));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      try {
        return mapBounds.contains([lat, lng]);
      } catch {
        return true;
      }
    });

    // 2. If enough in bounds, sort by distance from map center.
    //    Always append units without coordinates so they remain discoverable.
    if (inBounds.length >= MIN_VISIBLE) {
      const sortedInBounds = inBounds.sort((a, b) => {
        const dA = haversineKm(mapCenter.lat, mapCenter.lng, a.latitude!, a.longitude!);
        const dB = haversineKm(mapCenter.lat, mapCenter.lng, b.latitude!, b.longitude!);
        return dA - dB;
      });
      return [...sortedInBounds, ...withoutCoords];
    }

    // 3. Not enough in bounds — merge closest with-coords + all without-coords.
    //    Never hide units just because their coordinates haven't been geocoded yet.
    const sortedByCenter = [...withCoords].sort((a, b) => {
      const dA = haversineKm(mapCenter.lat, mapCenter.lng, a.latitude!, a.longitude!);
      const dB = haversineKm(mapCenter.lat, mapCenter.lng, b.latitude!, b.longitude!);
      return dA - dB;
    });
    return [...sortedByCenter, ...withoutCoords];
  }, [mapBounds, mapReady, userLocation, searchFilteredUnits]);

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

  const handleCardClick = useCallback((unit: UnitData) => {
    const slug = unit.brandSlug || unit.id;
    const fromParam = isChangeMode ? "change" : "discover";

    // Persist device-level signal for smart landing page
    localStorage.setItem('dub_has_barbershop', 'true');
    localStorage.setItem('dub_last_barbershop_slug', slug);
    localStorage.setItem('dub_last_barbershop_name', unit.brandName || unit.nome);

    // Modo convite: barbearia escolhida → segue direto pro cadastro
    // (WhatsApp OTP → email/senha) já vinculando o tenant à conta.
    if (isInviteMode) {
      const params = new URLSearchParams({
        mode: "signup",
        tenant: unit.tenant_id,
        origin: "discover",
      });
      params.set("next", "agendar");
      if (inviteRef) params.set("ref", inviteRef);
      navigate(`/auth?${params.toString()}`);
      return;
    }

    navigate(`/${slug}?from=${fromParam}&unidade=${unit.id}`);
  }, [isChangeMode, isInviteMode, inviteRef, navigate]);

  // ── Clicar na barbearia no mapa direciona direto para a página dela ──
  const handleSelectUnit = useCallback((id: string) => {
    const target = allUnits.find((u) => u.id === id);
    if (target) {
      handleCardClick(target);
    }
  }, [allUnits, handleCardClick]);

  const handleRecenter = useCallback(() => {
    setSelectedUnitId(null);
  }, []);

  return (
    <div
      id="escolher-barbearia-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        // @ts-ignore – CSS property not yet in React CSSProperties but critical for iOS Safari
        minHeight: '100dvh',
        overflow: 'hidden',
        background: '#E5E3DF',
        margin: 0,
        padding: 0,
        overscrollBehavior: 'none',
        // @ts-ignore
        overscrollBehaviorY: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >


      {/* ═══ Top Search Bar (Floating over map; solid background connecting with sheet when expanded) ═══ */}
      <div
        id="search-header"
        className="z-[600] pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          paddingBottom: isFullSnap && isScrolled ? '12px' : '10px',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        {/* Fundo suave com blur que surge apenas quando a gaveta se transforma em tela cheia */}
        <div
          className={cn(
            "absolute inset-0 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-xs pointer-events-none transition-opacity duration-300 ease-out",
            isFullSnap ? "opacity-100" : "opacity-0"
          )}
        />

        <div className="relative flex items-center gap-2.5 pointer-events-auto">
          {/* Botão de Voltar para a tela anterior (Padrão clean BackArrow em V) */}
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/cliente");
              }
            }}
            aria-label="Voltar para a tela anterior"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/95 text-foreground shadow-[0_2px_10px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-transform active:scale-90"
          >
            <BackArrow size={20} strokeWidth={2.2} className="text-foreground -ml-0.5" />
          </button>

          {/* Cápsula de Busca Flutuante (Estilo Airbnb) */}
          <div className="relative flex-1">
            <h1 className="sr-only">Buscar e descobrir barbearias próximas</h1>
            <div className="flex items-center w-full h-11 px-3.5 gap-2.5 rounded-full bg-background/95 border border-border/80 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all focus-within:ring-2 focus-within:ring-foreground/15">
              <Search className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" strokeWidth={1.8} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar barbearias..."
                aria-label="Buscar barbearias"
                value={search}
                onFocus={() => {
                  bottomSheetRef.current?.snapTo(SNAP_FULL);
                }}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) {
                    bottomSheetRef.current?.snapTo(SNAP_FULL);
                  }
                }}
                className="w-full text-[13.5px] font-normal text-foreground placeholder:text-muted-foreground/60 bg-transparent outline-none border-none p-0 focus:ring-0"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  className="text-muted-foreground/60 hover:text-foreground active:scale-90 transition-transform p-0.5"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Carrossel de Filtros Estratégico (Desaparece suave e leve ao rolar a lista sem engasgos) ═══ */}
        <div
          ref={carouselRef}
          onMouseDown={handleCarouselMouseDown}
          onMouseMove={handleCarouselMouseMove}
          onMouseUp={handleCarouselMouseUp}
          onMouseLeave={handleCarouselMouseUp}
          onWheel={handleCarouselWheel}
          className={cn(
            "relative flex items-center gap-2 no-scrollbar touch-pan-x pointer-events-auto select-none cursor-grab active:cursor-grabbing overflow-x-auto overflow-y-hidden transition-all duration-300 ease-out",
            search.trim() || (isFullSnap && isScrolled)
              ? "max-h-0 opacity-0 -translate-y-2 pointer-events-none py-0 my-0"
              : "max-h-12 opacity-100 translate-y-0 pt-2.5 pb-1 pointer-events-auto"
          )}
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {[
            { id: "near", label: "Mais perto de mim" },
            { id: "dub", label: "Unidades DUB" },
            { id: "top", label: "Melhor avaliadas" },
            { id: "sede", label: "Matriz / Sedes" },
            { id: "walking", label: "A pé (< 1.5 km)" },
            { id: "all", label: "Todas" },
          ].map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  "flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12.5px] transition-all active:scale-95 cursor-pointer whitespace-nowrap",
                  isActive
                    ? "border-[1.5px] border-foreground bg-background text-foreground font-semibold shadow-xs"
                    : "border border-border/80 bg-background/90 text-muted-foreground font-normal hover:border-foreground/40 hover:text-foreground shadow-xs backdrop-blur-xs"
                )}
              >
                {f.id === "dub" ? (
                  <span className="flex items-center gap-1.5">
                    <img
                      src={dubLogo}
                      alt="Barbearia DUB"
                      className="w-4 h-4 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/20 shadow-xs"
                    />
                    <span>Unidades DUB</span>
                  </span>
                ) : (
                  f.label
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Map — full screen behind sheet (sangra para cima absorvendo qualquer pull/overscroll) ═══ */}
      <div style={{ position: 'absolute', top: '-160px', left: 0, right: 0, bottom: 0, height: 'calc(100% + 160px)', zIndex: 0 }}>
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
        ref={bottomSheetRef}
        onSnapChange={(snap) => {
          setCurrentSheetSnap(snap);
          if (snap < 0.85) {
            setIsScrolled(false);
          }
        }}
        onScroll={handleListScroll}
        header={
          <div
            className="text-center px-5 pb-3 transition-[padding-top] duration-300 ease-out"
            style={{
              paddingTop: isFullSnap
                ? 'calc(env(safe-area-inset-top, 0px) + 124px)'
                : '8px',
            }}
          >
            <h2 className="text-[14.5px] font-medium text-foreground tracking-normal">
              {isLoading
                ? "Buscando barbearias..."
                : inBoundsCount >= visibleUnits.length
                  ? `${visibleUnits.length} barbearia${visibleUnits.length !== 1 ? "s" : ""} por perto`
                  : `Mais de ${visibleUnits.length} barbearia${visibleUnits.length !== 1 ? "s" : ""} próximas`}
            </h2>
          </div>
        }
      >
        <div className="px-4 pb-28">
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
                    searchQuery={search}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ═══ Floating Toggle Button ("Ver lista" / "Ver mapa") ═══ */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[700] pointer-events-auto"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <button
          type="button"
          onClick={() => {
            if (currentSheetSnap >= 0.85) {
              bottomSheetRef.current?.snapTo(SNAP_MID);
            } else {
              bottomSheetRef.current?.snapTo(SNAP_FULL);
            }
          }}
          className="flex items-center gap-2 bg-[#18181B] text-white px-5 py-2.5 rounded-full font-bold text-[13px] shadow-2xl active:scale-95 transition-transform"
        >
          {currentSheetSnap >= 0.85 ? (
            <>
              <MapIcon className="w-4 h-4" />
              <span>Ver mapa</span>
            </>
          ) : (
            <>
              <List className="w-4 h-4" />
              <span>Ver lista</span>
            </>
          )}
        </button>
      </div>


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
