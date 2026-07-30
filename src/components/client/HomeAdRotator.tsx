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
      className="relative w-full h-full text-left rounded-xl overflow-hidden bg-card active:scale-[0.99] transition-transform"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Imagem de fundo ocupando o card inteiro */}
      {ad.imageUrl ? (
        <img
          src={ad.imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}

      {/* Overlay para legibilidade do texto */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, hsl(0 0% 0% / 0.88) 0%, hsl(0 0% 0% / 0.72) 45%, hsl(0 0% 0% / 0.15) 100%)",
        }}
      />

      <div className="relative h-full w-full flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] mb-1 truncate text-primary-foreground/60">
            {ad.eyebrow}
          </p>
          <p className="text-primary-foreground font-semibold text-[14px] tracking-tight line-clamp-1">
            {ad.titulo}
          </p>
          {ad.descricao ? (
            <p className="text-[11px] text-primary-foreground/70 line-clamp-1 mt-0.5">
              {ad.descricao}
            </p>
          ) : null}
        </div>

        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary-foreground text-background px-3.5 h-8 text-[12px] font-semibold shadow-sm">
          {ad.ctaLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
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
  baseDurationMs = 2000,
  adDurationMs = 2500,
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
    // Reduced motion must disable only the movement, not the content rotation.
    // On Android, the system "Remove animations" option enables this media
    // query; previously that made the loyalty card remain visible forever.
    if (total <= 1 || paused) return;
    const isBase = hasBase && index === 0;
    timer.current = setTimeout(
      () => setIndex((i) => (i + 1) % total),
      isBase ? baseDurationMs : adDurationMs,
    );
    return () => clearTimeout(timer.current);
  }, [index, total, paused, hasBase, baseDurationMs, adDurationMs]);

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
          transition={{ duration: reducedMotion ? 0 : 0.25, ease: EASE }}
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
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.25, ease: EASE }}
            className="absolute inset-0"
          >
            <AdSlide ad={currentAd} onPress={() => handleAdPress(currentAd)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
