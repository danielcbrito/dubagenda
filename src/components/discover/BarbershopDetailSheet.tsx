import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, Navigation, X, Scissors, Users, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
  avgRating: number | null;
  totalReviews: number;
}

interface BarbershopDetailSheetProps {
  open: boolean;
  onClose: () => void;
  tenantId: string | null;
  tenantName: string;
  tenantLogo: string | null;
  tenantSlogan: string | null;
  tenantBairro: string | null;
  tenantCidade: string | null;
  tenantEstado: string | null;
  avgRating: number | null;
  totalReviews: number;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  isCurrent: boolean;
  saving: boolean;
  onSelect: () => void;
  isDub?: boolean;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function BarbershopDetailSheet({
  open, onClose, tenantId, tenantName, tenantLogo, tenantSlogan,
  tenantBairro, tenantCidade, tenantEstado,
  avgRating, totalReviews, distance, latitude, longitude,
  isCurrent, saving, onSelect, isDub,
}: BarbershopDetailSheetProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadBarbers();
  }, [open, tenantId]);

  const loadBarbers = async () => {
    setLoadingBarbers(true);
    try {
      let query = supabase
        .from("barbeiros")
        .select("id, apelido, foto_url")
        .eq("ativo", true)
        .is("deleted_at", null);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data: barberData } = await query;
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
      for (const r of (reviews || [])) {
        const cur = ratingMap.get(r.barber_id) || { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count += 1;
        ratingMap.set(r.barber_id, cur);
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
    if (latitude != null && longitude != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, "_blank");
    }
  };

  const location = [tenantBairro, tenantCidade, tenantEstado].filter(Boolean).join(", ");

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background rounded-t-2xl overflow-hidden"
            style={{ maxHeight: "92dvh" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-card/80 border border-border/20 flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-32">
              {/* ── Hero Section ── */}
              <div className="px-5 pt-4 pb-5">
                <div className="flex items-start gap-4">
                  {/* Logo grande */}
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden",
                    "bg-card border-2 border-border/20",
                    "shadow-lg shadow-background/50"
                  )}>
                    {tenantLogo ? (
                      <img src={tenantLogo} alt={tenantName} className="w-full h-full object-cover" />
                    ) : (
                      <Scissors className="w-7 h-7 text-muted-foreground/30" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-1">
                    <h2 className="text-[18px] font-bold text-foreground tracking-tight leading-tight">
                      {tenantName}
                    </h2>
                    {tenantSlogan && (
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5 italic">
                        {tenantSlogan}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      {avgRating != null && totalReviews > 0 && (
                        <span className="inline-flex items-center gap-1 bg-card/80 border border-border/15 rounded-lg px-2 py-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-[11px] font-bold tabular-nums text-foreground">{avgRating.toFixed(1)}</span>
                          <span className="text-[9px] text-muted-foreground/40">({totalReviews})</span>
                        </span>
                      )}

                      {distance != null && (
                        <span className="inline-flex items-center gap-1 bg-card/80 border border-border/15 rounded-lg px-2 py-1">
                          <Navigation className="w-3 h-3 text-primary/60" />
                          <span className="text-[11px] font-semibold tabular-nums text-foreground">{formatDistance(distance)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Location ── */}
              {location && (
                <div className="px-5 mb-4">
                  <button
                    onClick={handleOpenMaps}
                    disabled={latitude == null || longitude == null}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl",
                      "bg-card/60 border border-border/15",
                      "active:scale-[0.99] transition-all"
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-primary/70" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/40 font-semibold mb-0.5">
                        Localização
                      </p>
                      <p className="text-[12px] text-foreground/80 truncate">{location}</p>
                    </div>
                    {latitude != null && longitude != null && (
                      <div className="shrink-0 flex items-center gap-1 text-[9px] text-primary/60 font-medium">
                        <span>Rota</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* ── Barbers Section ── */}
              <div className="px-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-3.5 h-3.5 text-muted-foreground/30" />
                  <h3 className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/40 font-bold">
                    Profissionais
                  </h3>
                  {!loadingBarbers && (
                    <span className="text-[9px] tabular-nums text-muted-foreground/25 font-medium">
                      {barbers.length}
                    </span>
                  )}
                </div>

                {loadingBarbers ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 text-muted-foreground/30 animate-spin" />
                  </div>
                ) : barbers.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/30 text-center py-4">
                    Nenhum profissional disponível
                  </p>
                ) : (
                  <div className="space-y-2">
                    {barbers.map((barber, i) => (
                      <motion.div
                        key={barber.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.25 }}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-card/40 border border-border/10"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted/20 border border-border/15 shrink-0">
                          {barber.foto_url ? (
                            <img src={barber.foto_url} alt={barber.apelido} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[13px] font-bold text-muted-foreground/30">
                                {barber.apelido.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">{barber.apelido}</p>
                          {barber.avgRating != null && barber.totalReviews > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Star className="w-[9px] h-[9px] fill-amber-400 text-amber-400" />
                              <span className="text-[9px] font-semibold tabular-nums text-foreground/60">{barber.avgRating.toFixed(1)}</span>
                              <span className="text-[8px] text-muted-foreground/30">({barber.totalReviews})</span>
                            </div>
                          )}
                        </div>
                        <Scissors className="w-3.5 h-3.5 text-muted-foreground/15 shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Fixed CTA ── */}
            <div
              className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
              style={{ background: "linear-gradient(to top, hsl(var(--background)) 70%, transparent)" }}
            >
              <button
                onClick={onSelect}
                disabled={saving || isCurrent}
                className={cn(
                  "w-full h-[50px] rounded-xl font-bold text-[14px] tracking-wide",
                  "flex items-center justify-center gap-2",
                  "transition-all duration-200 active:scale-[0.97]",
                  isCurrent
                    ? "bg-card border border-primary/20 text-primary/60"
                    : "bg-foreground text-background shadow-lg shadow-foreground/10"
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  "Barbearia atual"
                ) : isDub ? (
                  "Voltar para DUB"
                ) : (
                  "Escolher esta barbearia"
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
