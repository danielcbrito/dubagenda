import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, MapPin, Navigation, Scissors, Users, Loader2, ExternalLink, ChevronRight, ArrowRight, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  buildAddressQueryFromParts,
  geocodeAddressFromParts,
  hasPreciseAddressParts,
  normalizeLocationText,
  pickResolvedCoordinates,
  readCachedGeocode,
  resolveStoredCoordinates,
  saveCachedGeocode,
  shouldPreferGeocodedCoordinates,
} from "@/lib/geocoding";
import logoDub from "@/assets/logo-dub.png";
import { useQuery } from "@tanstack/react-query";
import { BarberProfileSheet } from "@/components/discover/BarberProfileSheet";
import { PortfolioGallery } from "@/components/portfolio/PortfolioGallery";
import googleMapsIcon from "@/assets/google-maps-icon.png";

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
  avgRating: number | null;
  totalReviews: number;
}

interface TenantInfo {
  id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  endereco_completo: string | null;
  latitude: number | null;
  longitude: number | null;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

const DUB_COORDS = { lat: -23.7219695, lng: -46.7615913 };

const DUB_FALLBACK = {
  slogan: "Corte premium",
  logoUrl: logoDub,
  rua: "Rua Ferrador",
  numero: "108",
  bairro: "Cidade Ipava",
  cidade: "São Paulo",
  estado: "SP",
  enderecoCompleto: "Rua Ferrador, 108 - Cidade Ipava, São Paulo - SP",
};

function isPersonalImageUrl(url?: string | null): boolean {
  if (!url) return false;

  const value = url.trim().toLowerCase();
  if (!value) return false;

  return (
    value.includes("/storage/v1/object/public/avatars/") ||
    value.startsWith("avatars/") ||
    value.includes("/storage/v1/object/public/barber-photos/") ||
    value.startsWith("barber-photos/")
  );
}

function applyTenantFallbacks(tenant: TenantInfo, currentSlug?: string): TenantInfo {
  const isDub =
    normalizeText(tenant.nome) === "barbeariadub" ||
    normalizeText(currentSlug || "") === "barbeariadub";

  const safeLogoUrl = isPersonalImageUrl(tenant.logo_url) ? null : tenant.logo_url;

  if (!isDub) {
    return {
      ...tenant,
      logo_url: safeLogoUrl,
    };
  }

  return {
    ...tenant,
    slogan: tenant.slogan || DUB_FALLBACK.slogan,
    logo_url: safeLogoUrl || DUB_FALLBACK.logoUrl,
    rua: tenant.rua || DUB_FALLBACK.rua,
    numero: tenant.numero || DUB_FALLBACK.numero,
    bairro: tenant.bairro || DUB_FALLBACK.bairro,
    cidade: tenant.cidade || DUB_FALLBACK.cidade,
    estado: tenant.estado || DUB_FALLBACK.estado,
    endereco_completo: tenant.endereco_completo || DUB_FALLBACK.enderecoCompleto,
    latitude: tenant.latitude ?? DUB_COORDS.lat,
    longitude: tenant.longitude ?? DUB_COORDS.lng,
  };
}

const BarbershopPublic = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fromContext = searchParams.get("from"); // "discover" | "change" | null
  const unidadeIdParam = searchParams.get("unidade"); // specific unit ID
  const isFromDiscover = fromContext === "discover" || fromContext === "change";
  const isChangeMode = fromContext === "change";

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPreferred, setCurrentPreferred] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Check auth + preferred barbershop
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session) {
        setUserId(session.user.id);
        const { data: prof } = await supabase
          .from("profiles")
          .select("barbearia_preferida_id")
          .eq("id", session.user.id)
          .single();
        setCurrentPreferred(prof?.barbearia_preferida_id || null);
      }
    });
  }, []);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Load tenant by slug
  useEffect(() => {
    if (!slug) return;
    loadTenant();
  }, [slug]);

  const loadTenant = async () => {
    setLoading(true);

    // Try exact slug match first
    let { data, error } = await supabase
      .from("tenants")
      .select("id, nome, slogan, logo_url, telefone, whatsapp, email, site, rua, numero, bairro, cidade, estado, endereco_completo, latitude, longitude")
      .eq("slug", slug)
      .eq("ativo", true)
      .eq("onboarding_completed", true)
      .maybeSingle();

    // Fallback: case-insensitive ilike match
    if (!data) {
      const { data: fallbackData } = await supabase
        .from("tenants")
        .select("id, nome, slogan, logo_url, telefone, whatsapp, email, site, rua, numero, bairro, cidade, estado, endereco_completo, latitude, longitude")
        .ilike("slug", slug!)
        .eq("ativo", true)
        .eq("onboarding_completed", true)
        .maybeSingle();
      data = fallbackData;
    }

    // Fallback 2: maybe the slug is a barber name — find their tenant
    if (!data) {
      const normalizedSlug = slug!.replace(/-/g, ' ');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug!);

      let barberMatch: { tenant_id: string | null } | null = null;

      const { data: barberByName } = await supabase
        .from("barbeiros")
        .select("tenant_id")
        .ilike("apelido", normalizedSlug)
        .eq("ativo", true)
        .is("deleted_at", null)
        .not("tenant_id", "is", null)
        .limit(1)
        .maybeSingle();

      barberMatch = barberByName;

      if (!barberMatch && isUuid) {
        const { data: barberById } = await supabase
          .from("barbeiros")
          .select("tenant_id")
          .eq("id", slug!)
          .eq("ativo", true)
          .is("deleted_at", null)
          .not("tenant_id", "is", null)
          .limit(1)
          .maybeSingle();

        barberMatch = barberById;
      }

      if (barberMatch?.tenant_id) {
        const { data: tenantFromBarber } = await supabase
          .from("tenants")
          .select("id, nome, slogan, logo_url, telefone, whatsapp, email, site, rua, numero, bairro, cidade, estado, endereco_completo, latitude, longitude, slug")
          .eq("id", barberMatch.tenant_id)
          .eq("ativo", true)
          .eq("onboarding_completed", true)
          .maybeSingle();

        if (tenantFromBarber) {
          // Redirect to correct tenant slug URL
          if (tenantFromBarber.slug && tenantFromBarber.slug !== slug) {
            navigate(`/${tenantFromBarber.slug}`, { replace: true });
            return;
          }
          data = tenantFromBarber;
        }
      }
    }

    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setTenant(applyTenantFallbacks(data as TenantInfo, slug));
    setLoading(false);
    loadBarbers(data.id);
    loadBanner(data.id);
  };

  const loadBanner = async (tenantId: string) => {
    try {
      const { data: barberData } = await supabase
        .from("barbeiros")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .is("deleted_at", null)
        .limit(1)
        .single();

      if (barberData?.id) {
        const { data: banner } = await supabase
          .rpc("get_admin_banner_for_barber", { p_barbeiro_id: barberData.id });
        setBannerUrl(banner || null);
      }
    } catch {}
  };

  const loadBarbers = async (tenantId: string) => {
    setLoadingBarbers(true);
    try {
      // Fetch barbers strictly for this tenant (no legacy IS NULL fallback)
      const { data: barberData } = await supabase
        .from("barbeiros")
        .select("id, apelido, foto_url, tenant_id")
        .eq("ativo", true)
        .is("deleted_at", null)
        .eq("tenant_id", tenantId);

      if (!barberData || barberData.length === 0) {
        setBarbers([]);
        setLoadingBarbers(false);
        return;
      }

      const barberIds = barberData.map(b => b.id);
      const { data: reviews } = await supabase
        .from("barbeiro_avaliacoes")
        .select("barber_id, rating")
        .in("barber_id", barberIds);

      const ratingMap = new Map<string, { sum: number; count: number }>();
      let totalSum = 0;
      let totalCount = 0;
      for (const r of (reviews || [])) {
        const cur = ratingMap.get(r.barber_id) || { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count += 1;
        ratingMap.set(r.barber_id, cur);
        totalSum += r.rating;
        totalCount += 1;
      }

      if (totalCount > 0) {
        setAvgRating(totalSum / totalCount);
        setTotalReviews(totalCount);
      }

      const enrichedBarbers = barberData.map(b => {
        const stats = ratingMap.get(b.id);
        return {
          ...b,
          avgRating: stats ? stats.sum / stats.count : null,
          totalReviews: stats?.count || 0,
        };
      });

      const barberPhotoSet = new Set(
        enrichedBarbers
          .map((b) => b.foto_url?.trim())
          .filter((url): url is string => Boolean(url))
      );

      setTenant((prev) => {
        if (!prev?.logo_url) return prev;

        const normalizedLogo = prev.logo_url.trim();
        if (!normalizedLogo) return { ...prev, logo_url: null };

        if (barberPhotoSet.has(normalizedLogo) || isPersonalImageUrl(normalizedLogo)) {
          return {
            ...prev,
            logo_url: normalizeText(prev.nome) === "barbeariadub" ? DUB_FALLBACK.logoUrl : null,
          };
        }

        return prev;
      });

      setBarbers(enrichedBarbers);
    } catch (err) {
      console.error("Error loading barbers:", err);
    } finally {
      setLoadingBarbers(false);
    }
  };

  const handleOpenMaps = () => {
    const lat = unidadeAtual?.latitude ?? tenant?.latitude;
    const lng = unidadeAtual?.longitude ?? tenant?.longitude;
    if (lat != null && lng != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    }
  };

  // Load the correct unit's address (sede or specific unit via ?unidade=ID)
  const { data: unidadeAtual, isLoading: loadingUnidade } = useQuery({
    queryKey: ["unidade-atual", tenant?.id, unidadeIdParam],
    queryFn: async () => {
      const baseQuery = supabase
        .from("tenant_unidades")
        .select("id, nome, rua, numero, bairro, cidade, estado, telefone, whatsapp, latitude, longitude, is_sede, slug")
        .eq("tenant_id", tenant!.id);

      if (unidadeIdParam) {
        const { data, error } = await baseQuery.eq("id", unidadeIdParam).maybeSingle();
        if (error) throw error;
        if (data) return data;
        // Fallback to sede if specific unit not found
      }

      const { data, error } = await supabase
        .from("tenant_unidades")
        .select("id, nome, rua, numero, bairro, cidade, estado, telefone, whatsapp, latitude, longitude, is_sede, slug")
        .eq("tenant_id", tenant!.id)
        .eq("is_sede", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Units count query for "Ver todas as unidades" row
  const { data: unidadesCount } = useQuery({
    queryKey: ["unidades-count", tenant?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tenant_unidades")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!tenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  const [saving, setSaving] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);

  const handleJoin = async () => {
    if (!tenant) return;

    if (!isLoggedIn) {
      navigate(`/auth?mode=signup&origin=discover&tenant=${tenant.id}`);
      return;
    }

    // Logged in → select directly and go to home
    setSaving(true);
    try {
      const isDub = normalizeText(tenant.nome) === "barbeariadub";
      const updateData = {
        barbearia_preferida_id: tenant.id,
        signup_origin: isDub ? "dub_exclusive" : "discover",
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(`/auth?mode=login&origin=discover&tenant=${tenant.id}`);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", session.user.id);

      if (error) throw error;

      const { toast } = await import("sonner");
      toast.success(isChangeMode ? "Barbearia atualizada!" : "Barbearia selecionada!");
      navigate(isChangeMode ? "/cliente/perfil" : "/cliente");
    } catch (err) {
      console.error("Erro ao selecionar barbearia:", err);
      const { toast } = await import("sonner");
      toast.error("Erro ao selecionar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = () => {
    if (tenant) {
      navigate(`/auth?mode=login&origin=discover&tenant=${tenant.id}`);
    }
  };

  const isDubTenant = tenant ? normalizeText(tenant.nome) === "barbeariadub" : false;
  const resolvedLogoUrl = tenant?.logo_url && !isPersonalImageUrl(tenant.logo_url)
    ? tenant.logo_url
    : isDubTenant
      ? DUB_FALLBACK.logoUrl
      : null;

  const isCurrent = isLoggedIn && tenant && (
    isDubTenant
      ? (!currentPreferred || currentPreferred === tenant.id)
      : currentPreferred === tenant.id
  );

  // Use unit coordinates for distance, falling back to tenant-level
  const effectiveLat = unidadeAtual?.latitude ?? tenant?.latitude;
  const effectiveLng = unidadeAtual?.longitude ?? tenant?.longitude;

  const distance = userLocation && effectiveLat != null && effectiveLng != null
    ? haversineDistance(userLocation.lat, userLocation.lng, effectiveLat, effectiveLng)
    : null;

  // Address from unit data only (never from brand-level tenant)
  const unitStreetLine = unidadeAtual
    ? [unidadeAtual.rua, unidadeAtual.numero].filter(Boolean).join(", ")
    : "";

  const location = unidadeAtual
    ? [unidadeAtual.bairro, unidadeAtual.cidade, unidadeAtual.estado].filter(Boolean).join(", ")
    : "";

  const fullAddress = [unitStreetLine, location].filter(Boolean).join(" • ");

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center bg-background" style={{ height: "100dvh" }}>
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[11px] text-muted-foreground/40 mt-3">Carregando...</p>
      </div>
    );
  }

  // ── Not Found ──
  if (notFound || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center bg-background px-6" style={{ height: "100dvh" }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-card border border-border/30 flex items-center justify-center mb-4">
            <Scissors className="w-7 h-7 text-muted-foreground/30" />
          </div>
          <h1 className="text-[18px] font-bold text-foreground mb-1">Barbearia não encontrada</h1>
          <p className="text-[13px] text-muted-foreground/60 mb-6 max-w-[260px]">
            Este link pode estar incorreto ou a barbearia ainda não está disponível.
          </p>
          <button
            onClick={() => navigate("/")}
            className="h-11 px-6 rounded-xl bg-foreground text-background font-semibold text-[13px] active:scale-[0.97] transition-transform"
          >
            Ir para o início
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Main ──
  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-32">

        {/* ── Hero Banner ── */}
        <div className="relative w-full" style={{ minHeight: bannerUrl ? 280 : 180 }}>
          {bannerUrl ? (
            <>
              <img
                src={bannerUrl}
                alt={`Banner ${tenant.nome}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, transparent 0%, transparent 55%, hsl(var(--background) / 0.6) 80%, hsl(var(--background)) 100%)"
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)"
              }}
            />
          )}

          {/* Back / Home button */}
          <div className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-10">
            <button
              onClick={() => {
                if (isFromDiscover) {
                  navigate(isChangeMode ? "/escolher-barbearia?mode=change" : "/escolher-barbearia");
                } else {
                  navigate("/");
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60 backdrop-blur-md border border-border/30 active:scale-95 transition-all"
            >
              {isFromDiscover ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/70">
                    <path d="M9 14L4 9l5-5" />
                    <path d="M4 9h10a4 4 0 0 1 4 4v1" />
                  </svg>
                  <span className="text-[9px] font-bold text-foreground/70 uppercase tracking-wider">Voltar</span>
                </>
              ) : (
                <>
                  <img src={logoDub} alt="DUB" className="w-4 h-4 object-contain" />
                  <span className="text-[9px] font-bold text-foreground/70 uppercase tracking-wider">DUB Agenda</span>
                </>
              )}
            </button>
          </div>

          {/* Logo */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden",
              "bg-card border-[3px] border-background shadow-lg"
            )}>
              {resolvedLogoUrl ? (
                <img src={resolvedLogoUrl} alt={tenant.nome} className="w-full h-full object-cover" />
              ) : (
                <Scissors className="w-7 h-7 text-muted-foreground/40" />
              )}
            </div>
          </div>
        </div>

        {/* ── Name + Info ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center px-6 pt-14 pb-4"
        >
          <h1 className="text-[20px] font-bold text-foreground tracking-tight text-center leading-tight">
            {tenant.nome}
          </h1>

          {tenant.slogan && (
            <p className="text-[11px] text-muted-foreground mt-1 text-center italic leading-snug max-w-[240px]">
              {tenant.slogan}
            </p>
          )}

          {/* Rating + Distance */}
          <div className="flex items-center gap-2 mt-4">
            {avgRating != null && totalReviews > 0 && (
              <div className="flex items-center gap-1.5 bg-card border border-border/40 rounded-lg px-2.5 py-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-[12px] font-bold tabular-nums text-foreground">{avgRating.toFixed(1)}</span>
                <span className="text-[9px] text-muted-foreground">({totalReviews})</span>
              </div>
            )}

            {distance != null && (
              <div className="flex items-center gap-1.5 bg-card border border-border/40 rounded-lg px-2.5 py-1.5">
                <Navigation className="w-3 h-3 text-primary" />
                <span className="text-[12px] font-bold tabular-nums text-foreground">{formatDistance(distance)}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Location Card ── */}
        {(fullAddress || location) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="px-5 mb-6"
          >
            <button
              onClick={handleOpenMaps}
              disabled={effectiveLat == null || effectiveLng == null}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl",
                "bg-card border border-border/30",
                "active:scale-[0.985] transition-all duration-200"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/8 dark:bg-blue-500/12 flex items-center justify-center shrink-0">
                <img src={googleMapsIcon} alt="Maps" className="w-7 h-7 object-contain drop-shadow-[0_1px_4px_rgba(66,133,244,0.25)]" />
              </div>
              <p className="flex-1 text-[12px] text-foreground text-left truncate">
                {fullAddress || location || "Ver localização"}
              </p>
              {effectiveLat != null && effectiveLng != null && (
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              )}
            </button>
          </motion.div>
        )}

        {/* ── Ver Unidades Row ── */}
        {unidadesCount != null && unidadesCount >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="px-5 mb-6"
          >
            <button
              onClick={() => navigate(`/b/${slug}/unidades${unidadeAtual?.id ? `?current=${unidadeAtual.id}` : ""}`)}
              className={cn(
                "w-full flex items-center gap-3 px-4 h-14 rounded-2xl",
                "bg-card border border-border",
                "active:scale-[0.98] transition-all duration-150"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Building2 className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium text-foreground text-left">
                Ver todas as unidades
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            </button>
          </motion.div>
        )}

        {/* ── Barbers Section (ALWAYS on top) ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-muted-foreground/50" />
            <h3 className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
              Profissionais
            </h3>
            {!loadingBarbers && barbers.length > 0 && (
              <span className="text-[9px] tabular-nums text-muted-foreground/50 font-medium">
                {barbers.length}
              </span>
            )}
          </div>

          {loadingBarbers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : barbers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-6">
              Nenhum profissional disponível
            </p>
          ) : (
            <div className="space-y-2">
              {barbers.map((barber, i) => (
                <motion.button
                  key={barber.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.04, duration: 0.2 }}
                  onClick={() => setSelectedBarber(barber)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30 active:scale-[0.985] transition-transform text-left"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-muted/30 border border-border/20 shrink-0">
                    {barber.foto_url ? (
                      <img src={barber.foto_url} alt={barber.apelido} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[14px] font-semibold text-muted-foreground">
                          {barber.apelido.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{barber.apelido}</p>
                    {barber.avgRating != null && barber.totalReviews > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-[10px] h-[10px] fill-amber-400 text-amber-400" />
                        <span className="text-[10px] font-semibold tabular-nums text-foreground/70">{barber.avgRating.toFixed(1)}</span>
                        <span className="text-[8px] text-muted-foreground">({barber.totalReviews})</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Portfolio Section (below barbers, with spacing) ── */}
        {barbers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mt-6"
          >
            <PortfolioGallery
              barberIds={barbers.map(b => b.id)}
              barberMap={new Map(barbers.map(b => [b.id, { name: b.apelido, photo: b.foto_url }]))}
              maxVisible={9}
              showAttribution={true}
            />
          </motion.div>
        )}
      </div>

      {/* ── Fixed CTA ── */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        style={{ background: "linear-gradient(to top, hsl(var(--background)) 60%, transparent)" }}
      >
        {isLoggedIn ? (
          <div className="flex gap-2.5">
            {/* Botão Entrar — sempre visível quando logado */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={() => navigate("/cliente")}
              className={cn(
                "h-[52px] rounded-xl font-semibold text-[13px] tracking-wide",
                "flex items-center justify-center gap-1.5",
                "transition-all duration-200 active:scale-[0.985]",
                isCurrent
                  ? "flex-1 bg-foreground text-background shadow-lg"
                  : "flex-shrink-0 px-5 bg-card border border-border text-foreground"
              )}
            >
              <span>Entrar</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            {/* Botão Escolher — só quando NÃO é a barbearia atual */}
            {!isCurrent && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                onClick={handleJoin}
                disabled={saving}
                className={cn(
                  "flex-1 h-[52px] rounded-xl font-semibold text-[13px] tracking-wide",
                  "flex items-center justify-center gap-1.5",
                  "transition-all duration-200 active:scale-[0.985]",
                  "bg-foreground text-background shadow-lg",
                  saving && "opacity-70 pointer-events-none"
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isDubTenant ? (
                  "Voltar para DUB"
                ) : (
                  <>
                    <span>Escolher barbearia</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            )}
          </div>
        ) : (
          <div className="flex gap-2.5">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={handleLogin}
              className={cn(
                "flex-1 h-[52px] rounded-xl font-semibold text-[13px] tracking-wide",
                "flex items-center justify-center gap-1.5",
                "transition-all duration-200 active:scale-[0.985]",
                "bg-card border border-border text-foreground"
              )}
            >
              Já sou cliente
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              onClick={handleJoin}
              className={cn(
                "flex-1 h-[52px] rounded-xl font-semibold text-[13px] tracking-wide",
                "flex items-center justify-center gap-1.5",
                "transition-all duration-200 active:scale-[0.985]",
                "bg-foreground text-background shadow-lg"
              )}
            >
              <span>Criar conta</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>
      {/* Barber Profile Sheet */}
      <BarberProfileSheet
        open={!!selectedBarber}
        onClose={() => setSelectedBarber(null)}
        barberId={selectedBarber?.id || null}
        barberName={selectedBarber?.apelido || ""}
        barberPhoto={selectedBarber?.foto_url || null}
        barberAvgRating={selectedBarber?.avgRating ?? null}
        barberTotalReviews={selectedBarber?.totalReviews || 0}
      />
    </div>
  );
};

export default BarbershopPublic;
