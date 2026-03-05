import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ChevronLeft, ChevronRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PortfolioImage {
  id: string;
  barbeiro_id: string;
  image_url: string;
  descricao: string | null;
  barber_name?: string;
  barber_photo?: string | null;
}

interface PortfolioGalleryProps {
  barberIds: string[];
  /** Map barberId → { name, photo } for attribution */
  barberMap?: Map<string, { name: string; photo: string | null }>;
  /** Max images to show before "Ver mais" */
  maxVisible?: number;
  /** Title override */
  title?: string;
  /** Show barber attribution on each image */
  showAttribution?: boolean;
}

export function PortfolioGallery({
  barberIds,
  barberMap,
  maxVisible = 6,
  title = "Portfólio",
  showAttribution = true,
}: PortfolioGalleryProps) {
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (barberIds.length === 0) {
      setImages([]);
      setLoading(false);
      return;
    }
    loadPortfolio();
  }, [barberIds.join(",")]);

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("portfolio_images")
        .select("id, barbeiro_id, image_url, caption")
        .in("barbeiro_id", barberIds)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: PortfolioImage[] = (data || []).map((img) => {
        const barber = barberMap?.get(img.barbeiro_id);
        return {
          id: img.id,
          barbeiro_id: img.barbeiro_id,
          image_url: img.image_url,
          descricao: img.caption,
          barber_name: barber?.name || "",
          barber_photo: barber?.photo || null,
        };
      });

      setImages(enriched);
    } catch (err) {
      console.error("Erro ao carregar portfólio:", err);
    } finally {
      setLoading(false);
    }
  };

  const visibleImages = showAll ? images : images.slice(0, maxVisible);
  const hasMore = images.length > maxVisible && !showAll;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % images.length);
  };

  const goPrev = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
  };

  if (loading) {
    return (
      <div className="px-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-3.5 h-3.5 text-muted-foreground/50" />
          <h3 className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
            {title}
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-lg bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) return null;

  const currentImage = lightboxIndex !== null ? images[lightboxIndex] : null;

  return (
    <>
      <div className="px-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-3.5 h-3.5 text-muted-foreground/50" />
          <h3 className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
            {title}
          </h3>
          <span className="text-[9px] tabular-nums text-muted-foreground/50 font-medium">
            {images.length}
          </span>
        </div>

        {/* Masonry-style grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {visibleImages.map((img, i) => (
            <motion.button
              key={img.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              onClick={() => openLightbox(showAll ? i : i)}
              className={cn(
                "relative rounded-lg overflow-hidden bg-muted/20",
                "active:scale-[0.97] transition-transform",
                // Make first image larger for visual interest
                i === 0 && visibleImages.length > 3
                  ? "col-span-2 row-span-2 aspect-square"
                  : "aspect-square"
              )}
            >
              <img
                src={img.image_url}
                alt={img.descricao || "Corte"}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Barber attribution overlay */}
              {showAttribution && img.barber_name && (
                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="flex items-center gap-1">
                    {img.barber_photo ? (
                      <img
                        src={img.barber_photo}
                        alt={img.barber_name}
                        className="w-4 h-4 rounded-full object-cover border border-white/30"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="w-2.5 h-2.5 text-white/70" />
                      </div>
                    )}
                    <span className="text-[8px] font-semibold text-white/90 truncate">
                      {img.barber_name}
                    </span>
                  </div>
                </div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Ver mais */}
        {hasMore && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => setShowAll(true)}
            className="w-full mt-3 py-2.5 rounded-xl bg-card border border-border/30 text-[11px] font-semibold text-muted-foreground active:scale-[0.98] transition-transform"
          >
            Ver todos os {images.length} cortes
          </motion.button>
        )}
      </div>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxIndex !== null && currentImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Counter */}
            <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2 z-10">
              <span className="text-[11px] text-white/60 tabular-nums font-medium">
                {lightboxIndex + 1} / {images.length}
              </span>
            </div>

            {/* Image */}
            <motion.img
              key={currentImage.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              src={currentImage.image_url}
              alt={currentImage.descricao || "Corte"}
              className="max-w-[90vw] max-h-[70vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Attribution */}
            {currentImage.barber_name && (
              <div
                className="flex items-center gap-2 mt-4"
                onClick={(e) => e.stopPropagation()}
              >
                {currentImage.barber_photo ? (
                  <img
                    src={currentImage.barber_photo}
                    alt={currentImage.barber_name}
                    className="w-7 h-7 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-white/50" />
                  </div>
                )}
                <div>
                  <p className="text-[12px] font-semibold text-white/90">
                    {currentImage.barber_name}
                  </p>
                  {currentImage.descricao && (
                    <p className="text-[10px] text-white/50">{currentImage.descricao}</p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
