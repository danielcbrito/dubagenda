import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HomeAd } from "@/hooks/useHomeAds";

interface HomeAdRotatorProps {
  /** Card base (fidelidade) — permanece sempre no fluxo, define a altura */
  children?: ReactNode;
  ads: HomeAd[];
  /** Tempo do card base visível */
  baseDurationMs?: number;
  /** Tempo de cada anúncio visível */
  adDurationMs?: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function AdSlide({ ad, onPress }: { ad: HomeAd; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full h-full text-left rounded-xl border border-border bg-card overflow-hidden active:scale-[0.99] transition-transform"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="h-full w-full flex items-center gap-3 p-4">
        {ad.imageUrl ? (
          <div className="shrink-0 w-14 h-14 rounded-[14px] overflow-hidden bg-muted">
            <img
              src={ad.imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-semibold text-muted-foreground/60 uppercase tracking-[0.2em] mb-1 truncate">
            {ad.eyebrow}
          </p>
          <p className="text-foreground font-medium text-[13px] tracking-tight line-clamp-1">
            {ad.titulo}
          </p>
          {ad.descricao ? (
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
              {ad.descricao}
            </p>
          ) : null}
          <span className="inline-flex items-center gap-0.5 mt-2 text-[10px] font-semibold text-primary">
            {ad.ctaLabel}
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Alterna suavemente entre o card de fidelidade e os anúncios da barbearia/app.
 * O card base fica sempre montado (define altura e nunca "some" da home).
 */
export function HomeAdRotator({
  children,
  ads,
  baseDurationMs = 9000,
  adDurationMs = 6000,
}: HomeAdRotatorProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const hasBase = !!children;
  // slides: 0 = base (se existir) | demais = anúncios
  const total = (hasBase ? 1 : 0) + ads.length;

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    setIndex(0);
  }, [ads.length, hasBase]);

  useEffect(() => {
    if (total <= 1 || paused || reducedMotion) return;
    const isBase = hasBase && index === 0;
    timer.current = setTimeout(
      () => setIndex((i) => (i + 1) % total),
      isBase ? baseDurationMs : adDurationMs,
    );
    return () => clearTimeout(timer.current);
  }, [index, total, paused, hasBase, baseDurationMs, adDurationMs, reducedMotion]);

  // Pausa quando a aba não está visível (economia + não "queima" impressão)
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const handleAdPress = useCallback(
    (ad: HomeAd) => {
      const target = ad.ctaTarget;
      if (!target) return;
      if (target.startsWith("http")) {
        window.open(target, "_blank", "noopener,noreferrer");
      } else {
        navigate(target);
      }
    },
    [navigate],
  );

  if (total === 0) return null;

  const adIndex = hasBase ? index - 1 : index;
  const currentAd = adIndex >= 0 ? ads[adIndex] : null;

  return (
    <div
      className="relative"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* Card base sempre montado — mantém a altura estável */}
      {hasBase ? (
        <motion.div
          animate={{ opacity: currentAd ? 0 : 1 }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{ pointerEvents: currentAd ? "none" : "auto" }}
        >
          {children}
        </motion.div>
      ) : (
        <div className="h-[104px]" aria-hidden />
      )}

      <AnimatePresence mode="wait">
        {currentAd && (
          <motion.div
            key={currentAd.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="absolute inset-0"
          >
            <AdSlide ad={currentAd} onPress={() => handleAdPress(currentAd)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicadores discretos */}
      {total > 1 && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1 z-10">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                i === index ? "w-3.5 bg-foreground/50" : "w-1.5 bg-foreground/15"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
