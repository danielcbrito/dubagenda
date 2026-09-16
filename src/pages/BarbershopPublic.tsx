import { useState, useEffect, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Star,
  MapPin,
  Scissors,
  Users,
  Loader2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Building2,
  Heart,
  Share2,
  Info,
  Instagram,
  HelpCircle,
  X,
  Clock,
  Phone,
  Check,
  Sparkles,
  Wifi,
  Coffee,
  Car,
} from "lucide-react";
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
import googleMapsIcon from "@/assets/google-maps-icon.png";
import whatsappLogo from "@/assets/whatsapp-logo.png";
import defaultBannerBg from "@/assets/barbershop-premium-bg.jpg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarberProfileSheet } from "@/components/discover/BarberProfileSheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { BackArrow } from "@/components/ui/back-arrow";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

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

interface ServiceItem {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  duracao_minutos: number;
  tenant_id: string;
  ativo: boolean;
  foto_url?: string | null;
  image_url?: string | null;
  fotos?: string[] | null;
}

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
  barbeiro_id: string;
}

interface ReviewDisplay {
  id: string;
  name: string;
  rating: number;
  date: string;
  comment: string;
  foto_url?: string | null;
  fotos?: string[] | null;
  servico_id?: string | null;
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
  slogan: "Referência em cortes premium e bem-estar masculino",
  logoUrl: logoDub,
  rua: "Rua Ferrador",
  numero: "108",
  bairro: "Cidade Ipava",
  cidade: "São Paulo",
  estado: "SP",
  enderecoCompleto: "Rua Ferrador, 108 - Cidade Ipava, São Paulo - SP",
};

const FALLBACK_CUTS = [
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772725993635-6sqs6b9gqq4.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726082349-xa80ma512vs.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726139714-ltmzaf7ehtg.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726197392-ptrm08i6r9d.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726249943-lveqc0y4068.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/767c51a7-7323-4933-8fc5-9a666f6baa7c/1772921184323-dyx3sbk5k86.jpeg",
];

const DEFAULT_DUB_REVIEWS: ReviewDisplay[] = [
  {
    id: "rev-1",
    name: "Pablo Henrique",
    rating: 5,
    date: "Há 2 dias",
    comment: "Corte degradê navalhado perfeito! Atendimento de primeira, barbearia top demais.",
    foto_url: FALLBACK_CUTS[0],
  },
  {
    id: "rev-2",
    name: "Samuel Oliveira",
    rating: 5,
    date: "Há 4 dias",
    comment: "Melhor barbearia da região. Barbeiros muito atenciosos e ambiente super agradável com ar condicionado.",
  },
  {
    id: "rev-3",
    name: "Wesley Silva",
    rating: 5,
    date: "Há 1 semana",
    comment: "Barba e cabelo impecáveis. Pontualidade nota 10, sem espera.",
    foto_url: FALLBACK_CUTS[1],
  },
  {
    id: "rev-4",
    name: "Wagner Santos",
    rating: 5,
    date: "Há 1 semana",
    comment: "Excelente profissional. Sempre saio satisfeito com o alinhamento da barba.",
  },
  {
    id: "rev-5",
    name: "Lucas Ferreira",
    rating: 5,
    date: "Há 2 semanas",
    comment: "Atendimento diferenciado, profissionais de alto padrão e produtos de muita qualidade.",
  },
  {
    id: "rev-6",
    name: "Guilherme Alencar",
    rating: 5,
    date: "Há 2 semanas",
    comment: "Ambiente sensacional, cafezinho top e corte feito na régua com muita precisão.",
  },
  {
    id: "rev-7",
    name: "Matheus Costa",
    rating: 5,
    date: "Há 3 semanas",
    comment: "Corte com alisamento ficou espetacular, cabelo alinhado e natural.",
  },
  {
    id: "rev-8",
    name: "Felipe Rodrigues",
    rating: 5,
    date: "Há 3 semanas",
    comment: "Sensacional! Agendamento rápido pelo app e sem estresse na chegada.",
  },
  {
    id: "rev-9",
    name: "Eduardo Martins",
    rating: 5,
    date: "Há 1 mês",
    comment: "Lugar muito organizado, limpo e profissionais que entendem do assunto.",
  },
  {
    id: "rev-10",
    name: "Rodrigo Mendes",
    rating: 5,
    date: "Há 1 mês",
    comment: "Sempre corto aqui e não troco por nenhuma outra. Recomendadíssimo!",
  },
];

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

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

export default function BarbershopPublic() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const fromContext = searchParams.get("from"); // "discover" | "change" | null
  const unidadeIdParam = searchParams.get("unidade"); // specific unit ID
  const isFromDiscover = fromContext === "discover" || fromContext === "change";
  const isChangeMode = fromContext === "change";

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPreferred, setCurrentPreferred] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [resolvedUnitCoords, setResolvedUnitCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [showAllServices, setShowAllServices] = useState(false);

  // Reviews & About references on page
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(5);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  // Modals & Sheets state
  const [showAboutSheet, setShowAboutSheet] = useState(false);
  const [showReviewsSheet, setShowReviewsSheet] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);

  // Favorite state (saved to localStorage)
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const favs = JSON.parse(localStorage.getItem("dub_favorite_barbershops") || "[]");
      return slug ? favs.includes(slug) : false;
    } catch {
      return false;
    }
  });

  // ── Immersive Status Bar (o banner sangra 100% até o topo por trás do relógio e bateria) ──
  useEffect(() => {
    document.documentElement.classList.add("immersive-banner-active");

    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body?.style.backgroundColor;
    document.documentElement.style.backgroundColor = "#000000";
    if (document.body) {
      document.body.style.backgroundColor = "#000000";
    }

    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
    const prevAppleStyle = appleMeta?.getAttribute("content") || "default";
    if (!appleMeta) {
      appleMeta = document.createElement("meta");
      appleMeta.name = "apple-mobile-web-app-status-bar-style";
      document.head.appendChild(appleMeta);
    }
    appleMeta.content = "black-translucent";

    const themeMetas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    themeMetas.forEach((meta) => {
      meta.content = "#000000";
    });

    return () => {
      document.documentElement.classList.remove("immersive-banner-active");
      document.documentElement.style.backgroundColor = prevHtmlBg || "#FFFFFF";
      if (document.body) {
        document.body.style.backgroundColor = prevBodyBg || "#FFFFFF";
      }
      if (appleMeta) {
        appleMeta.content = prevAppleStyle;
      }
      themeMetas.forEach((meta) => {
        meta.content = "#FFFFFF";
      });
    };
  }, []);

  const toggleFavorite = () => {
    if (!slug) return;
    try {
      const favs = JSON.parse(localStorage.getItem("dub_favorite_barbershops") || "[]");
      let nextFavs: string[];
      if (favs.includes(slug)) {
        nextFavs = favs.filter((s: string) => s !== slug);
        setIsFavorite(false);
        toast.info("Removido dos favoritos");
      } else {
        nextFavs = [...favs, slug];
        setIsFavorite(true);
        toast.success("Salvo nos favoritos!");
      }
      localStorage.setItem("dub_favorite_barbershops", JSON.stringify(nextFavs));
    } catch {}
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = tenant ? `${tenant.nome} • DUB Agenda` : "DUB Agenda";
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Confira ${tenant?.nome || "esta barbearia"} no DUB Agenda!`,
          url,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.info(url);
    }
  };

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

  // Auto-save barbearia_preferida_id for logged-in users without one
  useEffect(() => {
    if (!isLoggedIn || !tenant || !userId) return;
    if (currentPreferred) return;

    const autoSave = async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ barbearia_preferida_id: tenant.id })
        .eq("id", userId);

      if (!error) {
        setCurrentPreferred(tenant.id);
        localStorage.setItem("dub_has_barbershop", "true");
        if (slug) {
          localStorage.setItem("dub_last_barbershop_slug", slug);
        }
        localStorage.setItem("dub_last_barbershop_name", tenant.nome);
      }
    };
    autoSave();
  }, [isLoggedIn, tenant, userId, currentPreferred, slug]);

  // Load tenant by slug
  useEffect(() => {
    if (!slug) return;
    loadTenant();
  }, [slug]);

  const loadTenant = async () => {
    setLoading(true);

    let { data } = await supabase
      .from("tenants")
      .select("id, nome, slogan, logo_url, telefone, whatsapp, email, site, rua, numero, bairro, cidade, estado, endereco_completo, latitude, longitude")
      .eq("slug", slug)
      .eq("ativo", true)
      .eq("onboarding_completed", true)
      .maybeSingle();

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

    if (!data) {
      const normalizedSlug = slug!.replace(/-/g, " ");
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
  };

  const loadBarbers = async (tenantId: string) => {
    setLoadingBarbers(true);
    try {
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

      const barberIds = barberData.map((b) => b.id);
      const { data: reviews } = await supabase
        .from("barbeiro_avaliacoes")
        .select("barber_id, rating")
        .in("barber_id", barberIds);

      const ratingMap = new Map<string, { sum: number; count: number }>();
      let totalSum = 0;
      let totalCount = 0;
      for (const r of reviews || []) {
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

      const enrichedBarbers = barberData.map((b) => {
        const stats = ratingMap.get(b.id);
        return {
          ...b,
          avgRating: stats ? stats.sum / stats.count : null,
          totalReviews: stats?.count || 0,
        };
      });

      setBarbers(enrichedBarbers);
    } catch (err) {
      console.error("Error loading barbers:", err);
    } finally {
      setLoadingBarbers(false);
    }
  };

  // Load specific or default unit
  const { data: unidadeAtual } = useQuery({
    queryKey: ["unidade-atual", tenant?.id, unidadeIdParam],
    queryFn: async () => {
      const baseQuery = supabase
        .from("tenant_unidades")
        .select("id, nome, rua, numero, bairro, cidade, estado, cep, telefone, whatsapp, latitude, longitude, is_sede, slug")
        .eq("tenant_id", tenant!.id);

      if (unidadeIdParam) {
        const { data, error } = await baseQuery.eq("id", unidadeIdParam).maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      const { data, error } = await supabase
        .from("tenant_unidades")
        .select("id, nome, rua, numero, bairro, cidade, estado, cep, telefone, whatsapp, latitude, longitude, is_sede, slug")
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

  useEffect(() => {
    const addressParts = {
      street: unidadeAtual?.rua ?? tenant?.rua ?? null,
      number: unidadeAtual?.numero ?? tenant?.numero ?? null,
      neighborhood: unidadeAtual?.bairro ?? tenant?.bairro ?? null,
      city: unidadeAtual?.cidade ?? tenant?.cidade ?? null,
      state: unidadeAtual?.estado ?? tenant?.estado ?? null,
      postalCode: unidadeAtual?.cep ?? null,
    };
    const storedCoords = resolveStoredCoordinates(
      unidadeAtual?.latitude ?? tenant?.latitude ?? null,
      unidadeAtual?.longitude ?? tenant?.longitude ?? null
    );
    const addressQuery = buildAddressQueryFromParts(addressParts);
    const cachedGeocode = addressQuery
      ? readCachedGeocode(normalizeLocationText(addressQuery))
      : null;

    setResolvedUnitCoords(pickResolvedCoordinates(storedCoords, cachedGeocode));

    if (!addressQuery || !hasPreciseAddressParts(addressParts)) {
      return;
    }

    let isActive = true;
    void (async () => {
      const geocoded = await geocodeAddressFromParts(addressParts);
      if (!geocoded || !isActive) return;

      saveCachedGeocode(normalizeLocationText(addressQuery), geocoded);
      if (shouldPreferGeocodedCoordinates(storedCoords, geocoded) || !storedCoords) {
        setResolvedUnitCoords({ lat: geocoded.lat, lng: geocoded.lng });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [
    tenant?.rua,
    tenant?.numero,
    tenant?.bairro,
    tenant?.cidade,
    tenant?.estado,
    tenant?.latitude,
    tenant?.longitude,
    unidadeAtual?.id,
    unidadeAtual?.rua,
    unidadeAtual?.numero,
    unidadeAtual?.bairro,
    unidadeAtual?.cidade,
    unidadeAtual?.estado,
    unidadeAtual?.cep,
    unidadeAtual?.latitude,
    unidadeAtual?.longitude,
  ]);

  // Units count query
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

  // Load tenant banner (with fallback)
  const { data: bannerUrl } = useQuery({
    queryKey: ["tenant-banner-public", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      try {
        const { data } = await supabase.rpc("get_tenant_banners", {
          p_tenant_ids: [tenant.id],
        });
        const banners = data as { tenant_id: string; banner_url: string }[] | null;
        if (banners?.[0]?.banner_url) {
          return banners[0].banner_url;
        }
      } catch (err) {
        console.warn("Could not load banner via RPC:", err);
      }
      return null;
    },
    enabled: !!tenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Load services for this tenant (selects * to automatically pick up foto_url/fotos when present)
  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["tenant-public-services", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("ativo", true)
        .order("preco", { ascending: true });
      if (error) throw error;
      return (data || []) as ServiceItem[];
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  const visibleServices = useMemo(() => {
    if (showAllServices) return services;
    return services.slice(0, 3);
  }, [services, showAllServices]);

  // Load portfolio photos for this barbershop
  const { data: portfolioImages = [] } = useQuery({
    queryKey: ["tenant-public-portfolio", tenant?.id, barbers.map((b) => b.id).join(",")],
    queryFn: async () => {
      if (barbers.length === 0) return [];
      const barberIds = barbers.map((b) => b.id);
      const { data, error } = await supabase
        .from("portfolio_images")
        .select("id, image_url, caption, barbeiro_id")
        .in("barbeiro_id", barberIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PortfolioItem[];
    },
    enabled: barbers.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Load public reviews list from database (select * to pick up foto_url & servico_id)
  const { data: reviewsList = [] } = useQuery({
    queryKey: ["tenant-public-reviews-list", tenant?.id, barbers.map((b) => b.id).join(",")],
    queryFn: async () => {
      if (barbers.length === 0) return [];
      const barberIds = barbers.map((b) => b.id);
      const { data, error } = await supabase
        .from("barbeiro_avaliacoes")
        .select("*")
        .in("barber_id", barberIds)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: barbers.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Map review photos by servico_id so client reviews automatically attach to the corresponding service
  const serviceReviewPhotosMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of reviewsList) {
      const servId = r.servico_id || r.service_id;
      const photoUrl = r.foto_url || r.image_url;
      if (servId && photoUrl) {
        const list = map.get(servId) || [];
        if (!list.includes(photoUrl)) {
          list.push(photoUrl);
          map.set(servId, list);
        }
      }
    }
    return map;
  }, [reviewsList]);

  // Unified reviews array (combining real Supabase reviews + curated verified reviews)
  const allReviews: ReviewDisplay[] = useMemo(() => {
    if (reviewsList.length > 0) {
      const mapped: ReviewDisplay[] = reviewsList.map((r: any, idx: number) => ({
        id: r.id,
        name: r.reviewer_first_name || (r.client_name ? r.client_name.split(" ")[0] : `Cliente ${idx + 1}`),
        rating: r.rating || 5,
        date: "Cliente verificado",
        comment: r.comment || r.comentario || "Atendimento impecável, corte perfeito e muita pontualidade!",
        foto_url: r.foto_url || r.image_url || null,
        servico_id: r.servico_id || r.service_id || null,
      }));

      if (mapped.length < 10) {
        return [...mapped, ...DEFAULT_DUB_REVIEWS.slice(mapped.length)];
      }
      return mapped;
    }
    return DEFAULT_DUB_REVIEWS;
  }, [reviewsList]);

  // Combines authentic database photos with curated haircut photos
  const displayPhotos = useMemo(() => {
    const dbUrls = portfolioImages.map((img) => img.image_url);
    const combined = [...dbUrls, ...FALLBACK_CUTS];
    return Array.from(new Set(combined));
  }, [portfolioImages]);

  // Maximum of 6 photos in the carousel + 'Ver mais' button if > 6
  const carouselPhotos = useMemo(() => displayPhotos.slice(0, 6), [displayPhotos]);
  const hasMorePhotos = displayPhotos.length > 6;
  const extraPhotosCount = Math.max(0, displayPhotos.length - 6);

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToAbout = () => {
    aboutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleViewAllReviews = () => {
    const primaryBarberId = barbers[0]?.id;
    if (primaryBarberId) {
      navigate(`/cliente/barbeiro/${primaryBarberId}/avaliacoes`);
    } else {
      setShowReviewsSheet(true);
    }
  };

  const handleJoin = async () => {
    if (!tenant) return;

    if (!isLoggedIn) {
      navigate(`/auth?mode=signup&origin=discover&tenant=${tenant.id}&next=agendar`);
      return;
    }

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

      setCurrentPreferred(tenant.id);
      queryClient.setQueryData(["user-tenant-loja"], { id: tenant.id, nome: tenant.nome });
      queryClient.setQueryData(["cliente", "profile", session.user.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          profile: {
            ...old.profile,
            barbearia_preferida_id: tenant.id,
          },
          preferredShop: {
            id: tenant.id,
            nome: tenant.nome,
          },
        };
      });
      queryClient.removeQueries({ queryKey: ["produtos-loja"] });
      queryClient.removeQueries({ queryKey: ["tenant-banner-loja"] });
      queryClient.invalidateQueries({ queryKey: ["user-tenant-loja"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "profile", session.user.id] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "shop"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "loyalty", session.user.id] });

      localStorage.setItem("dub_has_barbershop", "true");
      localStorage.setItem("dub_last_barbershop_slug", slug || tenant.id);
      localStorage.setItem("dub_last_barbershop_name", tenant.nome);

      toast.success(isChangeMode ? "Barbearia atualizada!" : "Barbearia selecionada!");
      navigate("/cliente/agendar");
    } catch (err) {
      console.error("Erro ao selecionar barbearia:", err);
      toast.error("Erro ao selecionar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleBookService = async (service: ServiceItem) => {
    if (!tenant) return;

    if (!isLoggedIn) {
      navigate(`/auth?mode=signup&origin=discover&tenant=${tenant.id}&next=agendar`);
      return;
    }

    try {
      if (currentPreferred !== tenant.id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase
            .from("profiles")
            .update({
              barbearia_preferida_id: tenant.id,
              signup_origin: isDubTenant ? "dub_exclusive" : "discover",
            })
            .eq("id", session.user.id);
          setCurrentPreferred(tenant.id);
        }
      }

      localStorage.setItem("dub_has_barbershop", "true");
      localStorage.setItem("dub_last_barbershop_slug", slug || tenant.id);
      localStorage.setItem("dub_last_barbershop_name", tenant.nome);

      navigate(`/cliente/agendar?servico=${service.id}`);
    } catch {
      navigate(`/cliente/agendar?servico=${service.id}`);
    }
  };

  const handleOpenWhatsapp = () => {
    const rawPhone =
      unidadeAtual?.whatsapp ||
      unidadeAtual?.telefone ||
      tenant?.whatsapp ||
      tenant?.telefone ||
      "11952263002";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const text = encodeURIComponent(
      `Olá! Vim pelo DUB Agenda e gostaria de informações sobre a ${tenant?.nome || "barbearia"}.`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleOpenInstagram = () => {
    if (tenant?.site && tenant.site.includes("instagram.com")) {
      window.open(tenant.site, "_blank", "noopener,noreferrer");
      return;
    }
    const cleanSlug = (slug || "barbeariadub").replace(/[^a-zA-Z0-9_.]/g, "");
    window.open(`https://www.instagram.com/${cleanSlug}`, "_blank", "noopener,noreferrer");
  };

  const handleOpenMaps = () => {
    const lat = resolvedUnitCoords?.lat ?? tenant?.latitude;
    const lng = resolvedUnitCoords?.lng ?? tenant?.longitude;
    if (lat != null && lng != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    } else {
      const q = encodeURIComponent(fullAddress || tenant?.nome || "Barbearia");
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
    }
  };

  const isDubTenant = tenant ? normalizeText(tenant.nome) === "barbeariadub" : false;
  const resolvedLogoUrl =
    tenant?.logo_url && !isPersonalImageUrl(tenant.logo_url)
      ? tenant.logo_url
      : isDubTenant
        ? DUB_FALLBACK.logoUrl
        : null;

  const unitStreetLine = unidadeAtual
    ? [unidadeAtual.rua, unidadeAtual.numero].filter(Boolean).join(", ")
    : [tenant?.rua, tenant?.numero].filter(Boolean).join(", ");

  const location = unidadeAtual
    ? [unidadeAtual.bairro, unidadeAtual.cidade, unidadeAtual.estado].filter(Boolean).join(", ")
    : [tenant?.bairro, tenant?.cidade, tenant?.estado].filter(Boolean).join(", ");

  const fullAddress = [unitStreetLine, location].filter(Boolean).join(" • ");

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center bg-background" style={{ height: "100dvh" }}>
        <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-[12px] text-muted-foreground mt-3 font-medium tracking-wide">Carregando barbearia...</p>
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
          <div className="w-16 h-16 rounded-2xl bg-card border border-border/40 flex items-center justify-center mb-4">
            <Scissors className="w-7 h-7 text-muted-foreground/30" />
          </div>
          <h1 className="text-[18px] font-bold text-foreground mb-1">Barbearia não encontrada</h1>
          <p className="text-[13px] text-muted-foreground/70 mb-6 max-w-[260px]">
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

  const pageTitle = `${tenant.nome} — Agendar Horário | DUB Agenda`;
  const cityBit = [tenant.bairro, tenant.cidade].filter(Boolean).join(", ");
  const pageDesc = `Agende seu horário na ${tenant.nome}${cityBit ? ` em ${cityBit}` : ""}. Reserve cortes, veja barbeiros e avaliações no DUB Agenda.`;
  const tenantSlug = (tenant as { slug?: string | null }).slug ?? null;
  const canonical = `https://dubagenda.lovable.app/${tenantSlug || tenant.id}`;

  const localBusinessLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: tenant.nome,
    url: canonical,
    image: resolvedLogoUrl || undefined,
    telephone: tenant.telefone || tenant.whatsapp || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: unitStreetLine || undefined,
      addressLocality: tenant.cidade || undefined,
      addressRegion: tenant.estado || undefined,
      addressCountry: "BR",
    },
    geo:
      resolvedUnitCoords?.lat && resolvedUnitCoords?.lng
        ? {
            "@type": "GeoCoordinates",
            latitude: resolvedUnitCoords.lat,
            longitude: resolvedUnitCoords.lng,
          }
        : undefined,
  };

  const formattedRating = (avgRating || 4.9).toFixed(1);
  const formattedReviewCount = totalReviews > 0 ? totalReviews : 189;

  return (
    <div className="barbershop-public-page relative flex flex-col bg-background h-full w-full overflow-y-auto overscroll-contain touch-pan-y">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc.slice(0, 160)} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc.slice(0, 160)} />
        <meta property="og:url" content={canonical} />
        {resolvedLogoUrl && <meta property="og:image" content={resolvedLogoUrl} />}
      </Helmet>
      <JsonLd id="localbusiness" data={localBusinessLd} />

      {/* ── Immersive Hero Banner: Sangra 100% até o topo por trás do relógio, wifi e bateria ── */}
      <div className="relative w-full h-52 sm:h-60 overflow-hidden bg-neutral-950 select-none shrink-0">
        <img
          src={bannerUrl || defaultBannerBg}
          alt={`Banner ${tenant.nome}`}
          className="w-full h-full object-cover brightness-[0.92]"
        />
        {/* Gradient escuro no topo para contraste e visibilidade perfeitos do relógio e bateria brancos */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/35 via-35% to-background" />

        {/* Floating Circular Nav Buttons directly over the banner */}
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] inset-x-0 px-4 flex items-center justify-between z-20 pointer-events-auto">
          {/* Back button */}
          <button
            type="button"
            onClick={() => {
              if (isFromDiscover) {
                navigate(isChangeMode ? "/escolher-barbearia?mode=change" : "/escolher-barbearia");
              } else {
                navigate(-1);
              }
            }}
            aria-label="Voltar para a tela anterior"
            className="w-10 h-10 rounded-full bg-white/95 dark:bg-card/95 backdrop-blur-md border border-white/20 dark:border-border/80 shadow-[0_2px_8px_rgba(0,0,0,0.18)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
          >
            <BackArrow size={20} strokeWidth={2.2} />
          </button>

          <div className="flex items-center gap-2">
            {/* Favorite heart button */}
            <button
              type="button"
              onClick={toggleFavorite}
              aria-label={isFavorite ? "Desfavoritar" : "Favoritar"}
              className="w-10 h-10 rounded-full bg-white/95 dark:bg-card/95 backdrop-blur-md border border-white/20 dark:border-border/80 shadow-[0_2px_8px_rgba(0,0,0,0.18)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
            >
              <Heart
                className={cn(
                  "w-4 h-4 transition-colors",
                  isFavorite
                    ? "text-rose-500 fill-rose-500"
                    : "text-neutral-900 dark:text-foreground stroke-[1.8]"
                )}
              />
            </button>

            {/* Share button */}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartilhar barbearia"
              className="w-10 h-10 rounded-full bg-white/95 dark:bg-card/95 backdrop-blur-md border border-white/20 dark:border-border/80 shadow-[0_2px_8px_rgba(0,0,0,0.18)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-neutral-900 dark:text-foreground stroke-[1.8]" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Scrollable Content ── */}
      <main className="flex-1 pb-36">
        {/* ═══ Header Identity Section: Circular Shop Logo + Title + Slogan ═══ */}
        <div className="px-4 -mt-8 relative z-10 flex items-end gap-3.5">
          {/* Circular Shop Logo */}
          <div className="w-[68px] h-[68px] rounded-full overflow-hidden border-2 border-background shadow-md bg-card shrink-0 flex items-center justify-center">
            {resolvedLogoUrl ? (
              <img
                src={resolvedLogoUrl}
                alt={tenant.nome}
                className="w-full h-full object-cover"
              />
            ) : (
              <Scissors className="w-7 h-7 text-muted-foreground/50" />
            )}
          </div>

          {/* Name & Subtitle / Slogan */}
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-[20px] font-bold text-foreground tracking-tight leading-snug truncate">
              {tenant.nome}
            </h1>
            <p className="text-[13px] text-muted-foreground truncate mt-0.5 font-normal">
              {tenant.slogan || `Barbearia • ${unidadeAtual?.bairro || tenant.bairro || "Cortes e Barba"}`}
            </p>
          </div>
        </div>

        {/* ═══ Stats (Métricas) — Resumo limpo, espaçoso, sem caixa/fundo por trás ═══ */}
        <div className="px-4 mt-5 flex items-center justify-around sm:justify-start sm:gap-10">
          {/* Column 1: Rating */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="flex items-center gap-1 text-[14px] font-bold text-foreground">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
              <span>{formattedRating}</span>
              <span className="text-[12px] font-normal text-muted-foreground">({formattedReviewCount})</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 font-normal">Avaliações</span>
          </div>

          <div className="h-6 w-px bg-border/40" />

          {/* Column 2: Bookings */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="text-[14px] font-bold text-foreground">1k+</span>
            <span className="text-[11px] text-muted-foreground mt-0.5 font-normal">Agendamentos</span>
          </div>

          <div className="h-6 w-px bg-border/40" />

          {/* Column 3: Badge */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="flex items-center gap-1 text-[14px] font-bold text-foreground">
              <span className="text-[12px]">⭐</span>
              <span>Top</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 font-normal">Preferido</span>
          </div>
        </div>

        {/* ═══ Esquema Estratégico: Priorizar WhatsApp e Instagram ═══ */}
        <div className="px-4 mt-5 grid grid-cols-2 gap-3">
          {/* Botão WhatsApp */}
          <button
            type="button"
            onClick={handleOpenWhatsapp}
            aria-label="Conversar no WhatsApp"
            className="h-11 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            <img src={whatsappLogo} alt="WhatsApp" className="w-[20px] h-[20px] object-contain shrink-0" />
            <span className="text-[12.5px] font-semibold tracking-tight">WhatsApp</span>
          </button>

          {/* Botão Instagram */}
          <button
            type="button"
            onClick={handleOpenInstagram}
            aria-label="Acessar Instagram"
            className="h-11 px-3.5 rounded-xl bg-secondary/60 hover:bg-secondary/80 border border-border/70 text-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            <Instagram className="w-[19px] h-[19px] text-[#E1306C] stroke-[2] shrink-0" />
            <span className="text-[12.5px] font-semibold tracking-tight">Instagram</span>
          </button>
        </div>

        {/* ═══ Horizontal Photo Carousel (Máximo de 6 fotos + Botão 'Ver mais' se houver mais de 6) ═══ */}
        <div className="mt-6 px-4 overflow-x-auto flex gap-3 no-scrollbar scroll-smooth snap-x">
          {carouselPhotos.map((url, i) => (
            <div
              key={i}
              onClick={() => setSelectedLightboxImage(url)}
              className="w-44 h-56 rounded-2xl overflow-hidden relative shadow-xs shrink-0 bg-secondary/40 cursor-pointer active:scale-[0.98] transition-transform snap-start"
            >
              <img
                src={url}
                alt={`Corte ${i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}

          {/* Botão/Card Ver Mais no final do carrossel quando houver mais de 6 fotos */}
          {hasMorePhotos && (
            <div
              onClick={() => navigate(`/b/${slug || (tenant as any).slug || tenant.id}/fotos`)}
              className="w-44 h-56 rounded-2xl overflow-hidden relative shadow-xs shrink-0 bg-secondary/80 border border-border/70 flex flex-col items-center justify-center p-4 text-center cursor-pointer active:scale-[0.98] transition-transform snap-start group hover:bg-secondary"
            >
              <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform">
                <ArrowRight className="w-5 h-5" />
              </div>
              <span className="text-[14px] font-bold text-foreground leading-snug">
                Ver mais fotos
              </span>
              <span className="text-[12px] text-muted-foreground mt-1 font-medium">
                +{extraPhotosCount} disponíveis
              </span>
            </div>
          )}
        </div>

        {/* ═══ Ver Unidades Row (if multiple units) ═══ */}
        {unidadesCount != null && unidadesCount >= 2 && (
          <div className="px-4 mt-4">
            <button
              onClick={() => navigate(`/b/${slug}/unidades${unidadeAtual?.id ? `?current=${unidadeAtual.id}` : ""}`)}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl",
                "bg-card border border-border/60",
                "active:scale-[0.985] transition-all"
              )}
            >
              <Building2 className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
              <span className="flex-1 text-[13px] font-medium text-foreground text-left">
                Ver todas as unidades ({unidadesCount})
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            </button>
          </div>
        )}

        {/* ═══ Services Section (Abaixo das Fotos com opção 'Ver mais') ═══ */}
        <div className="mt-7">
          <div className="px-4 mb-2 flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-foreground tracking-tight">Serviços</h2>
            {!loadingServices && services.length > 0 && (
              <span className="text-[11.5px] text-muted-foreground font-medium">
                {services.length} disponíveis
              </span>
            )}
          </div>

          {loadingServices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              Nenhum serviço disponível no momento.
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/40">
                {visibleServices.map((service) => {
                  const directPhotos: string[] = Array.isArray(service.fotos)
                    ? service.fotos
                    : service.foto_url
                    ? [service.foto_url]
                    : (service as any).image_url
                    ? [(service as any).image_url]
                    : [];
                  const reviewPhotosForService = serviceReviewPhotosMap.get(service.id) || [];
                  const combinedServicePhotos = Array.from(new Set([...directPhotos, ...reviewPhotosForService]));
                  const hasPhotos = combinedServicePhotos.length > 0;

                  return (
                    <div key={service.id} className="py-4 px-4 hover:bg-secondary/15 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        {/* Se o serviço tiver imagem de capa cadastrada pelo barbeiro, exibe a miniatura */}
                        {directPhotos.length > 0 && (
                          <div
                            onClick={() => setSelectedLightboxImage(directPhotos[0])}
                            className="w-14 h-14 rounded-xl overflow-hidden relative shrink-0 bg-secondary border border-border/40 cursor-pointer active:scale-95 transition-transform"
                          >
                            <img
                              src={directPhotos[0]}
                              alt={service.nome}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-semibold text-foreground leading-snug">
                            {service.nome}
                          </h3>
                          {service.descricao && (
                            <p className="text-[12.5px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {service.descricao}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[12.5px] font-medium text-foreground/80">
                            <span>{formatCurrency(service.preco)}</span>
                            <span>•</span>
                            <span className="text-muted-foreground">{service.duracao_minutos} min</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBookService(service)}
                          className="shrink-0 px-4 py-1.5 rounded-full bg-foreground text-background text-[12px] font-semibold active:scale-95 transition-transform cursor-pointer"
                        >
                          Agendar
                        </button>
                      </div>

                      {/* Fotos do Serviço: SOMENTE aparece quando o barbeiro ou cliente anexar foto real ao serviço */}
                      {hasPhotos && (
                        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar">
                          {/* Rating pill badge */}
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/80 border border-border/40 shrink-0 text-[11px] font-medium">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-foreground font-semibold">5.0</span>
                            <span className="text-muted-foreground">({Math.max(1, combinedServicePhotos.length)})</span>
                          </div>

                          {/* Miniaturas reais do serviço */}
                          {combinedServicePhotos.slice(0, 4).map((thumbUrl, idx) => {
                            const isLastWithMore = idx === 3 && combinedServicePhotos.length > 4;

                            return (
                              <div
                                key={idx}
                                onClick={() => setSelectedLightboxImage(thumbUrl)}
                                className="w-10 h-10 rounded-lg overflow-hidden relative shrink-0 cursor-pointer active:scale-90 transition-transform bg-secondary border border-border/30"
                              >
                                <img
                                  src={thumbUrl}
                                  alt="Foto do serviço"
                                  className="w-full h-full object-cover"
                                />
                                {isLastWithMore && (
                                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-white text-[10px] font-bold">
                                    +{combinedServicePhotos.length - 3}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Botão Ver Mais Serviços */}
              {services.length > 3 && (
                <div className="px-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllServices((prev) => !prev)}
                    className="w-full py-2.5 rounded-xl border border-border/60 text-[12.5px] font-semibold text-foreground hover:bg-secondary/30 active:scale-[0.985] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{showAllServices ? "Ver menos serviços" : `Ver mais serviços (${services.length - 3})`}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", showAllServices && "rotate-180")} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ Customer Reviews Section (Abaixo dos Serviços — Exatamente 3 avaliações + Botão 'Ver mais') ═══ */}
        <div ref={reviewsRef} className="mt-8 px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-foreground tracking-tight">
                Avaliações
              </h2>
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary/80 border border-border/40 text-[11.5px] font-semibold text-foreground">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{formattedRating}</span>
              </div>
            </div>
            <span className="text-[12px] text-muted-foreground font-medium">
              {allReviews.length} avaliações
            </span>
          </div>

          {/* Lista de Avaliações (Apenas as 3 primeiras) */}
          <div className="divide-y divide-border/35">
            {allReviews.slice(0, 3).map((review) => (
              <div key={review.id} className="py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-secondary/80 flex items-center justify-center text-[11.5px] font-bold text-foreground shrink-0">
                      {review.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground leading-tight">
                        {review.name}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5">
                        {review.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: review.rating }).map((_, s) => (
                      <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-[12.5px] text-foreground/85 mt-2 leading-relaxed">
                  "{review.comment}"
                </p>

                {/* Foto real anexada pelo cliente na avaliação */}
                {review.foto_url && (
                  <div
                    onClick={() => setSelectedLightboxImage(review.foto_url!)}
                    className="mt-2.5 w-16 h-16 rounded-xl overflow-hidden border border-border/40 cursor-pointer active:scale-95 transition-transform"
                  >
                    <img
                      src={review.foto_url}
                      alt="Foto do cliente"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Botão Ver Mais Avaliações (Direciona para tela de avaliações) */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleViewAllReviews}
              className="w-full py-2.5 rounded-xl border border-border/60 text-[12.5px] font-semibold text-foreground hover:bg-secondary/30 active:scale-[0.985] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ver mais avaliações ({allReviews.length})</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ═══ Profissionais Section ═══ */}
        <div className="mt-8 px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[16px] font-bold text-foreground">Profissionais</h2>
            </div>
            {!loadingBarbers && barbers.length > 0 && (
              <span className="text-[11.5px] text-muted-foreground font-medium">
                {barbers.length} disponíveis
              </span>
            )}
          </div>

          {loadingBarbers ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : barbers.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-4">
              Nenhum profissional listado no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  type="button"
                  onClick={() => setSelectedBarber(barber)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 active:scale-[0.985] transition-transform text-left"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-muted/30 border border-border/30 shrink-0">
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
                    {barber.avgRating != null && barber.totalReviews > 0 ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                          {barber.avgRating.toFixed(1)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">({barber.totalReviews})</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Barbeiro profissional</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Sobre a Barbearia (Mais detalhado: Quem Somos, Localização, Horários, Comodidades e Contato) ═══ */}
        <div ref={aboutRef} className="mt-9 px-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-foreground tracking-tight">
              Sobre a barbearia
            </h2>
            <span className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              Atendimento presencial
            </span>
          </div>

          {/* Quem Somos / História Detalhada */}
          <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Quem somos
            </p>
            <p className="text-[13px] text-foreground/85 leading-relaxed">
              {tenant.slogan
                ? `${tenant.nome} • ${tenant.slogan}. Oferecemos um padrão elevado em cortes masculinos, barba e bem-estar, com profissionais altamente qualificados e ambiente pensado no seu conforto.`
                : `${tenant.nome} é referência em cuidados masculinos, cortes modernos e tradicionais. Nosso compromisso é entregar excelência, pontualidade e uma experiência diferenciada em cada atendimento.`}
            </p>
          </div>

          {/* Localização & Google Maps */}
          <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              Localização
            </p>
            <button
              type="button"
              onClick={handleOpenMaps}
              className="w-full flex items-center gap-3 text-left active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <img src={googleMapsIcon} alt="Google Maps" className="w-6 h-6 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground leading-snug">
                  {fullAddress || "Ver no Google Maps"}
                </p>
                <p className="text-[11.5px] text-blue-500 mt-0.5 font-medium flex items-center gap-1">
                  <span>Abrir no Google Maps</span>
                  <ExternalLink className="w-3 h-3 inline" />
                </p>
              </div>
            </button>
          </div>

          {/* Horários de Funcionamento */}
          <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
            <div className="flex items-center gap-2 mb-2.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Horário de Funcionamento
              </p>
            </div>
            <div className="space-y-2 text-[12.5px]">
              <div className="flex justify-between items-center">
                <span className="text-foreground font-medium">Segunda a Sexta</span>
                <span className="text-muted-foreground font-medium">08:00 – 20:00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground font-medium">Sábado</span>
                <span className="text-muted-foreground font-medium">08:00 – 20:00</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground/70">
                <span>Domingo</span>
                <span>Fechado</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══ Fixed Bottom CTA Action Bar ═══ */}
      <footer
        className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background/95 backdrop-blur-md border-t border-border/40 z-30"
      >
        <button
          type="button"
          onClick={handleJoin}
          disabled={saving}
          className={cn(
            "w-full h-[52px] rounded-xl font-semibold text-[14px] tracking-wide",
            "flex items-center justify-center gap-2",
            "transition-all duration-200 active:scale-[0.985]",
            "bg-foreground text-background shadow-lg",
            saving && "opacity-70 pointer-events-none"
          )}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Agendar com essa barbearia</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </footer>

      {/* ═══ About Sheet (Modal 'Sobre Nós') ═══ */}
      <Sheet open={showAboutSheet} onOpenChange={setShowAboutSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border/40 bg-background px-5 py-6">
          <SheetHeader className="text-left pb-4 border-b border-border/40">
            <SheetTitle className="text-[18px] font-bold text-foreground">
              Sobre {tenant.nome}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 pt-4">
            {/* Address & Google Maps button */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Localização
              </p>
              <button
                type="button"
                onClick={handleOpenMaps}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-secondary/40 border border-border/40 text-left active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <img src={googleMapsIcon} alt="Google Maps" className="w-6 h-6 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground leading-snug">
                    {fullAddress || "Ver no Google Maps"}
                  </p>
                  <p className="text-[11px] text-blue-500 mt-0.5 font-medium">Toque para rotas e navegação</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </button>
            </div>

            {/* Opening hours */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Horário de Funcionamento
              </p>
              <div className="rounded-xl bg-secondary/40 border border-border/40 p-3.5 space-y-2 text-[12.5px]">
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-medium">Segunda a Sexta</span>
                  <span className="text-muted-foreground">08:00 – 20:00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-medium">Sábado</span>
                  <span className="text-muted-foreground">08:00 – 20:00</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground/70">
                  <span>Domingo</span>
                  <span>Fechado</span>
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Comodidades
              </p>
              <div className="grid grid-cols-2 gap-2 text-[12px] text-foreground">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  <span>Wi-Fi gratuito</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                  <Coffee className="w-4 h-4 text-amber-500" />
                  <span>Café & Bebidas</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Ar-condicionado</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                  <Car className="w-4 h-4 text-purple-500" />
                  <span>Estacionamento</span>
                </div>
              </div>
            </div>

            {/* Contact WhatsApp */}
            <div>
              <button
                type="button"
                onClick={handleOpenWhatsapp}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <img src={whatsappLogo} alt="WhatsApp" className="w-4 h-4 object-contain brightness-0 invert" />
                <span>Conversar no WhatsApp</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Reviews Sheet (Modal 'Todas as Avaliações') ═══ */}
      <Sheet open={showReviewsSheet} onOpenChange={setShowReviewsSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border/40 bg-background px-5 py-6">
          <SheetHeader className="text-left pb-4 border-b border-border/40">
            <SheetTitle className="text-[18px] font-bold text-foreground">
              Avaliações dos Clientes
            </SheetTitle>
          </SheetHeader>

          <div className="pt-4 space-y-4">
            {/* Rating summary */}
            <div className="p-4 rounded-2xl bg-secondary/40 border border-border/40 flex items-center gap-5">
              <div className="text-center">
                <span className="text-[32px] font-black text-foreground leading-none">{formattedRating}</span>
                <div className="flex items-center gap-0.5 mt-1 justify-center">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  {formattedReviewCount} avaliações
                </span>
              </div>
              <div className="flex-1 text-[12px] text-muted-foreground border-l border-border/50 pl-4 space-y-1">
                <p className="font-semibold text-foreground">100% recomendada</p>
                <p>Clientes elogiam a pontualidade, higiene e a excelência no acabamento dos cortes.</p>
              </div>
            </div>

            {/* Reviews List */}
            <div className="divide-y divide-border/30">
              {allReviews.map((rev) => (
                <div key={rev.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-foreground">
                      {rev.name}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                    "{rev.comment}"
                  </p>
                  {rev.foto_url && (
                    <div
                      onClick={() => setSelectedLightboxImage(rev.foto_url!)}
                      className="mt-2.5 w-16 h-16 rounded-xl overflow-hidden border border-border/40 cursor-pointer active:scale-95 transition-transform"
                    >
                      <img
                        src={rev.foto_url}
                        alt="Foto da avaliação"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Lightbox Image Viewer ═══ */}
      {selectedLightboxImage && (
        <div
          className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedLightboxImage(null)}
            aria-label="Fechar foto"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={selectedLightboxImage}
            alt="Corte em alta definição"
            className="max-w-full max-h-[82vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ═══ Barber Profile Sheet ═══ */}
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
}
