import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, Navigation, Scissors, Users, Loader2, ExternalLink } from "lucide-react";
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

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a4 4 0 0 1 4 4v1" />
    </svg>
  );
}

export function BarbershopDetailSheet({
  open, onClose, tenantId, tenantName, tenantLogo, tenantSlogan,
  tenantBairro, tenantCidade, tenantEstado,
  avgRating, totalReviews, distance, latitude, longitude,
  isCurrent, saving, onSelect, isDub,
}: BarbershopDetailSheetProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadBarbers();
    loadBanner();
  }, [open, tenantId]);

  const loadBanner = async () => {
    try {
      let query = supabase
        .from("barbeiros")
        .select("id")
        .eq("ativo", true)
        .is("deleted_at", null)
        .limit(1);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data: barberData } = await query.single();
      if (barberData?.id) {
        const { data: banner } = await supabase
          .rpc("get_admin_banner_for_barber", { p_barbeiro_id: barberData.id });
        setBannerUrl(banner || null);
      }
    } catch (err) {
      console.error("Error loading banner:", err);
    }
  };

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
        <motion.div
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-32">

            {/* ── Hero Banner ── */}
            <div className="relative w-full" style={{ minHeight: bannerUrl ? 260 : 160 }}>
              {bannerUrl ? (
                <>
                  <img
                    src={bannerUrl}
                    alt={`Banner ${tenantName}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Lighter overlay so banner is clearly visible */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.25) 50%, hsl(var(--background)) 100%)"
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

              {/* Back button */}
              <button
                onClick={onClose}
                className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-10 w-10 h-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-md border border-border/30 active:scale-95 transition-all text-foreground"
              >
                <BackArrow />
              </button>

              {/* Logo */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
                <div className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden",
                  "bg-card border-[3px] border-background shadow-premium"
                )}>
                  {tenantLogo ? (
                    <img src={tenantLogo} alt={tenantName} className="w-full h-full object-cover" />
                  ) : (
                    <Scissors className="w-7 h-7 text-muted-foreground/40" />
                  )}
                </div>
              </div>
            </div>

            {/* ── Name + Info ── */}
            <div className="flex flex-col items-center px-6 pt-14 pb-4">
              <h1 className="text-[19px] font-bold font-display text-foreground tracking-tight text-center leading-tight">
                {tenantName}
              </h1>

              {tenantSlogan && (
                <p className="text-[11px] text-muted-foreground mt-1 text-center italic leading-snug max-w-[220px]">
                  {tenantSlogan}
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
            </div>

            {/* ── Location Card ── */}
            {location && (
              <div className="px-5 mb-6">
                <button
                  onClick={handleOpenMaps}
                  disabled={latitude == null || longitude == null}
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
                      Localização
                    </p>
                    <p className="text-[12px] text-foreground truncate">{location}</p>
                  </div>
                  {latitude != null && longitude != null && (
                    <div className="shrink-0 flex items-center gap-1 text-[9px] text-primary font-medium">
                      <span>Ir</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* ── Barbers Section ── */}
            <div className="px-5">
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
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30 active:scale-[0.985] transition-transform"
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
                      <Scissors className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Fixed CTA — foreground/background (preto no light, branco no dark) ── */}
          <div
            className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            style={{ background: "linear-gradient(to top, hsl(var(--background)) 60%, transparent)" }}
          >
            <button
              onClick={onSelect}
              disabled={saving || isCurrent}
              className={cn(
                "w-full h-[50px] rounded-xl font-semibold text-[14px] tracking-wide",
                "flex items-center justify-center gap-2",
                "transition-all duration-200 active:scale-[0.985]",
                isCurrent
                  ? "bg-card border border-border text-muted-foreground"
                  : "bg-foreground text-background shadow-premium"
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
      )}
    </AnimatePresence>
  );
}
