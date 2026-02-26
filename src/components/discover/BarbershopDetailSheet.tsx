import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, Navigation, ArrowLeft, Scissors, Users, Loader2, ExternalLink } from "lucide-react";
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
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { return; }
    loadBarbers();
    loadBanner();
  }, [open, tenantId]);

  const loadBanner = async () => {
    try {
      if (tenantId) {
        // Get owner_user_id from tenant, then banner from profiles
        const { data: tenant } = await supabase
          .from("tenants")
          .select("owner_user_id")
          .eq("id", tenantId)
          .single();
        if (tenant?.owner_user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("banner_url")
            .eq("id", tenant.owner_user_id)
            .single();
          setBannerUrl(profile?.banner_url || null);
        }
      } else {
        // DUB: get admin user's banner
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .single();
        if (adminRole?.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("banner_url")
            .eq("id", adminRole.user_id)
            .single();
          setBannerUrl(profile?.banner_url || null);
        }
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
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          {/* ── Scrollable Content ── */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-32">

            {/* ── Hero Banner ── */}
            <div className="relative w-full" style={{ minHeight: bannerUrl ? 220 : 140 }}>
              {bannerUrl ? (
                <>
                  <img
                    src={bannerUrl}
                    alt={`Banner ${tenantName}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Gradient overlay for readability */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to bottom, hsl(var(--background) / 0.3) 0%, hsl(var(--background) / 0.7) 60%, hsl(var(--background)) 100%)"
                    }}
                  />
                </>
              ) : (
                /* Subtle gradient fallback */
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(to bottom, hsl(var(--card)) 0%, hsl(var(--background)) 100%)"
                  }}
                />
              )}

              {/* Back button — floats on top of banner */}
              <button
                onClick={onClose}
                className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-4 z-10 w-8 h-8 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-md border border-border/20 active:scale-90 transition-transform"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" strokeWidth={2} />
              </button>

              {/* Logo — centered, overlapping bottom of banner */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
                <div className={cn(
                  "w-[72px] h-[72px] rounded-2xl flex items-center justify-center overflow-hidden",
                  "bg-card border-[3px] border-background shadow-lg shadow-background/40"
                )}>
                  {tenantLogo ? (
                    <img src={tenantLogo} alt={tenantName} className="w-full h-full object-cover" />
                  ) : (
                    <Scissors className="w-7 h-7 text-muted-foreground/20" />
                  )}
                </div>
              </div>
            </div>

            {/* ── Name + Info (below logo) ── */}
            <div className="flex flex-col items-center px-6 pt-12 pb-5">
              <h1 className="text-[19px] font-bold text-foreground tracking-tight text-center">
                {tenantName}
              </h1>

              {tenantSlogan && (
                <p className="text-[11px] text-muted-foreground/40 mt-0.5 text-center italic">
                  {tenantSlogan}
                </p>
              )}

              {/* Rating + Distance chips */}
              <div className="flex items-center gap-2.5 mt-3.5">
                {avgRating != null && totalReviews > 0 && (
                  <div className="flex items-center gap-1.5 bg-card border border-border/15 rounded-lg px-2.5 py-1.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-[12px] font-bold tabular-nums text-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground/40">({totalReviews})</span>
                  </div>
                )}

                {distance != null && (
                  <div className="flex items-center gap-1.5 bg-card border border-border/15 rounded-lg px-2.5 py-1.5">
                    <Navigation className="w-3 h-3 text-primary/50" />
                    <span className="text-[12px] font-semibold tabular-nums text-foreground">{formatDistance(distance)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Location Card ── */}
            {location && (
              <div className="px-5 mb-5">
                <button
                  onClick={handleOpenMaps}
                  disabled={latitude == null || longitude == null}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-xl",
                    "bg-card/60 border border-border/15",
                    "active:scale-[0.99] transition-all"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                    <MapPin className="w-[18px] h-[18px] text-primary/60" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/35 font-semibold mb-0.5">
                      Localização
                    </p>
                    <p className="text-[12px] text-foreground/70 truncate">{location}</p>
                  </div>
                  {latitude != null && longitude != null && (
                    <div className="shrink-0 flex items-center gap-1 text-[9px] text-primary/50 font-medium">
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
                <Users className="w-3.5 h-3.5 text-muted-foreground/25" />
                <h3 className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/35 font-bold">
                  Profissionais
                </h3>
                {!loadingBarbers && barbers.length > 0 && (
                  <span className="text-[9px] tabular-nums text-muted-foreground/20 font-medium">
                    {barbers.length}
                  </span>
                )}
              </div>

              {loadingBarbers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 text-muted-foreground/25 animate-spin" />
                </div>
              ) : barbers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/25 text-center py-6">
                  Nenhum profissional disponível
                </p>
              ) : (
                <div className="space-y-2">
                  {barbers.map((barber, i) => (
                    <motion.div
                      key={barber.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/10"
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-muted/15 border border-border/10 shrink-0">
                        {barber.foto_url ? (
                          <img src={barber.foto_url} alt={barber.apelido} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-[14px] font-semibold text-muted-foreground/25">
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
                            <span className="text-[10px] font-semibold tabular-nums text-foreground/50">{barber.avgRating.toFixed(1)}</span>
                            <span className="text-[8px] text-muted-foreground/25">({barber.totalReviews})</span>
                          </div>
                        )}
                      </div>
                      <Scissors className="w-3.5 h-3.5 text-muted-foreground/10 shrink-0" />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Fixed CTA ── */}
          <div
            className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            style={{ background: "linear-gradient(to top, hsl(var(--background)) 60%, transparent)" }}
          >
            <button
              onClick={onSelect}
              disabled={saving || isCurrent}
              className={cn(
                "w-full h-[48px] rounded-xl font-semibold text-[14px] tracking-wide",
                "flex items-center justify-center gap-2",
                "transition-all duration-200 active:scale-[0.97]",
                isCurrent
                  ? "bg-card border border-primary/15 text-primary/50"
                  : "bg-foreground text-background shadow-md shadow-foreground/8"
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
