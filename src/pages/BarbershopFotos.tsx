import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { X, Scissors, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackArrow } from "@/components/ui/back-arrow";

interface TenantInfo {
  id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
}

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
}

const FALLBACK_CUTS = [
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772725993635-6sqs6b9gqq4.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726082349-xa80ma512vs.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726139714-ltmzaf7ehtg.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726197392-ptrm08i6r9d.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/ee238642-bc38-4de6-ba86-9eed40262fc7/1772726249943-lveqc0y4068.jpeg",
  "https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/portfolio/767c51a7-7323-4933-8fc5-9a666f6baa7c/1772921184323-dyx3sbk5k86.jpeg",
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export default function BarbershopFotos() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);

  // Load tenant
  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ["tenant-fotos-page", slug],
    queryFn: async () => {
      if (!slug) return null;

      const clean = normalizeText(slug);
      let query = supabase.from("tenants").select("id, nome, slogan, logo_url");

      if (clean === "barbeariadub") {
        query = query.or(`slug.eq.barbeariadub,nome.ilike.%barbearia dub%,nome.ilike.%dub%`);
      } else {
        query = query.or(`slug.eq.${slug},id.eq.${slug},nome.ilike.%${slug}%`);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data as TenantInfo | null;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Load barbers for this tenant
  const { data: barbers = [] } = useQuery({
    queryKey: ["tenant-barbers-fotos", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data } = await supabase
        .from("barbeiros")
        .select("id")
        .eq("tenant_id", tenant.id);
      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Load portfolio photos
  const { data: portfolioImages = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ["tenant-portfolio-fotos-page", tenant?.id, barbers.map((b) => b.id).join(",")],
    queryFn: async () => {
      if (barbers.length === 0) return [];
      const barberIds = barbers.map((b) => b.id);
      const { data, error } = await supabase
        .from("portfolio_images")
        .select("id, image_url, caption")
        .in("barbeiro_id", barberIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PortfolioItem[];
    },
    enabled: barbers.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Combine database images with fallback cuts
  const allPhotos = useMemo(() => {
    const dbUrls = portfolioImages.map((img) => img.image_url);
    const combined = [...dbUrls, ...FALLBACK_CUTS];
    return Array.from(new Set(combined));
  }, [portfolioImages]);

  const shopName = tenant?.nome || "Barbearia";
  const pageTitle = `Fotos e Cortes — ${shopName} | DUB Agenda`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Galeria completa de fotos e cortes de cabelo da ${shopName}.`} />
      </Helmet>

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="w-10 h-10 rounded-full bg-white dark:bg-card border border-neutral-200/80 dark:border-border/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
          >
            <BackArrow size={20} strokeWidth={2.2} />
          </button>
          <div>
            <h1 className="text-[16px] font-bold tracking-tight text-foreground leading-snug">
              Galeria de Fotos
            </h1>
            <p className="text-[11.5px] text-muted-foreground font-normal">
              {shopName} • {allPhotos.length} fotos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border/40 text-[11px] font-semibold text-foreground">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Trabalhos Reais</span>
        </div>
      </header>

      {/* Main Content: Photo Grid */}
      <main className="flex-1 p-4 pb-20">
        {loadingTenant || loadingPhotos ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-[12.5px]">Carregando fotos...</p>
          </div>
        ) : allPhotos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Scissors className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-[14px] font-medium">Nenhuma foto encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {allPhotos.map((url, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                onClick={() => setSelectedLightboxImage(url)}
                className="aspect-[3/4] rounded-xl overflow-hidden relative shadow-xs bg-secondary/40 cursor-pointer group active:scale-[0.98] transition-transform"
              >
                <img
                  src={url}
                  alt={`Corte ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox Viewer */}
      <AnimatePresence>
        {selectedLightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedLightboxImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <button
              type="button"
              onClick={() => setSelectedLightboxImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedLightboxImage}
              alt="Visualização do corte"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
