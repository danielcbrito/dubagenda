import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  barberMap?: Map<string, { name: string; photo: string | null }>;
  maxVisible?: number;
  showAttribution?: boolean;
}

export function PortfolioGallery({
  barberIds,
  barberMap,
  maxVisible = 9,
  showAttribution = true,
}: PortfolioGalleryProps) {
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PortfolioImage | null>(null);

  const barberIdsKey = useMemo(() => barberIds.join(","), [barberIds]);

  useEffect(() => {
    if (barberIds.length === 0) {
      setImages([]);
      setLoading(false);
      return;
    }
    loadPortfolio();
  }, [barberIdsKey]);

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

      setImages(
        (data || []).map((img) => {
          const barber = barberMap?.get(img.barbeiro_id);
          return {
            id: img.id,
            barbeiro_id: img.barbeiro_id,
            image_url: img.image_url,
            descricao: img.caption,
            barber_name: barber?.name || "",
            barber_photo: barber?.photo || null,
          };
        })
      );
    } catch (err) {
      console.error("Erro ao carregar portfólio:", err);
    } finally {
      setLoading(false);
    }
  };

  const visibleImages = showAll ? images : images.slice(0, maxVisible);
  const hasMore = images.length > maxVisible && !showAll;

  if (loading) {
    return (
      <div className="px-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-3.5 h-3.5 text-muted-foreground/50" />
          <h3 className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
            Portfólio
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-[3px]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-sm bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) return null;

  return (
    <>
      <div className="px-5 mb-6">
        {/* Title */}
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-3.5 h-3.5 text-muted-foreground/50" />
          <h3 className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
            Portfólio
          </h3>
          <span className="text-[9px] tabular-nums text-muted-foreground/50 font-medium">
            {images.length}
          </span>
        </div>

        {/* Grid 3 columns */}
        <div className="grid grid-cols-3 gap-[3px]">
          {visibleImages.map((img, i) => (
            <motion.button
              key={img.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              onClick={() => setSelectedImage(img)}
              className="relative aspect-square overflow-hidden bg-muted/20 active:opacity-70 transition-opacity"
            >
              <img
                src={img.image_url}
                alt={img.descricao || "Corte"}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Barber avatar badge */}
              {showAttribution && img.barber_photo && (
                <div className="absolute bottom-1.5 right-1.5">
                  <img
                    src={img.barber_photo}
                    alt={img.barber_name || ""}
                    className="w-5 h-5 rounded-full object-cover border-[1.5px] border-background shadow-sm"
                  />
                </div>
              )}
              {showAttribution && !img.barber_photo && img.barber_name && (
                <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-muted border-[1.5px] border-background flex items-center justify-center shadow-sm">
                  <User className="w-2.5 h-2.5 text-muted-foreground" />
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
            Ver mais cortes
          </motion.button>
        )}
      </div>

      {/* ── Image preview overlay ── */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={() => setSelectedImage(null)}
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-muted/60 active:scale-95 transition-transform"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              className="relative w-[85vw] max-w-[400px] aspect-square rounded-xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.image_url}
                alt={selectedImage.descricao || "Corte"}
                className="w-full h-full object-cover"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
