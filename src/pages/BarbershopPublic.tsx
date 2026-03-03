import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, MapPin, Navigation, Scissors, Users, Loader2, ExternalLink, ChevronRight, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import logoDub from "@/assets/logo-dub.png";

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

function applyTenantFallbacks(tenant: TenantInfo, currentSlug?: string): TenantInfo {
  const isDub =
    normalizeText(tenant.nome) === "barbeariadub" ||
    normalizeText(currentSlug || "") === "barbeariadub";

  if (!isDub) return tenant;

  return {
    ...tenant,
    slogan: tenant.slogan || DUB_FALLBACK.slogan,
    logo_url: tenant.logo_url || DUB_FALLBACK.logoUrl,
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

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
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
      // Fetch barbers: both tenant-specific AND global (tenant_id IS NULL)
      const { data: barberData } = await supabase
        .from("barbeiros")
        .select("id, apelido, foto_url, tenant_id")
        .eq("ativo", true)
        .is("deleted_at", null)
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

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

      setBarbers(barberData.map(b => {
        const stats = ratingMap.get(b.id);
        return {
          ...b,
          avgRating: stats ? stats.sum / stats.count : null,
          totalReviews: stats?.count || 0,
        };
      }));
    } catch (err) {
      console.error("Error loading barbers:", err);
    } finally {
      setLoadingBarbers(false);
    }
  };

  const handleOpenMaps = () => {
    if (tenant?.latitude != null && tenant?.longitude != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${tenant.latitude},${tenant.longitude}`, "_blank");
    }
  };

  const handleJoin = () => {
    if (tenant) {
      if (isLoggedIn) {
        navigate(`/escolher-barbearia?mode=change`);
      } else {
        navigate(`/auth?mode=signup&origin=discover&tenant=${tenant.id}`);
      }
    }
  };

  const handleLogin = () => {
    if (tenant) {
      navigate(`/auth?mode=login&origin=discover&tenant=${tenant.id}`);
    }
  };

  const distance = userLocation && tenant?.latitude != null && tenant?.longitude != null
    ? haversineDistance(userLocation.lat, userLocation.lng, tenant.latitude, tenant.longitude)
    : null;

  const streetLine = tenant
    ? [tenant.rua, tenant.numero].filter(Boolean).join(", ")
    : "";

  const location = tenant
    ? [tenant.bairro, tenant.cidade, tenant.estado].filter(Boolean).join(", ")
    : "";

  const fullAddress = tenant
    ? (tenant.endereco_completo?.trim() || [streetLine, location].filter(Boolean).join(" • "))
    : "";

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

          {/* Powered by DUB badge */}
          <div className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-10">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60 backdrop-blur-md border border-border/30 active:scale-95 transition-all"
            >
              <img src={logoDub} alt="DUB" className="w-4 h-4 object-contain" />
              <span className="text-[9px] font-bold text-foreground/70 uppercase tracking-wider">DUB Agenda</span>
            </button>
          </div>

          {/* Logo */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden",
              "bg-card border-[3px] border-background shadow-lg"
            )}>
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
              ) : (
                <img src={logoDub} alt="Logo DUB" className="w-9 h-9 object-contain" />
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
              disabled={tenant.latitude == null || tenant.longitude == null}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl",
                "bg-card border border-border/40",
                "active:scale-[0.985] transition-all"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-[18px] h-[18px] text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-0.5">
                  Endereço
                </p>
                {fullAddress && (
                  <p className="text-[12px] text-foreground leading-snug">{fullAddress}</p>
                )}
                {location && location !== fullAddress && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{location}</p>
                )}
              </div>
              {tenant.latitude != null && tenant.longitude != null && (
                <div className="shrink-0 flex items-center gap-1 text-[9px] text-primary font-medium">
                  <span>Ir</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              )}
            </button>
          </motion.div>
        )}

        {/* ── Barbers Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
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
                <motion.div
                  key={barber.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.04, duration: 0.2 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30"
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
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Fixed CTA ── */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        style={{ background: "linear-gradient(to top, hsl(var(--background)) 60%, transparent)" }}
      >
        {isLoggedIn ? (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={handleJoin}
            className={cn(
              "w-full h-[52px] rounded-xl font-semibold text-[14px] tracking-wide",
              "flex items-center justify-center gap-2",
              "transition-all duration-200 active:scale-[0.985]",
              "bg-foreground text-background shadow-lg"
            )}
          >
            <span>Escolher esta barbearia</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
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
    </div>
  );
};

export default BarbershopPublic;
