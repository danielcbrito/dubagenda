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
  /** Primeira exibição do card base (mais curta, para o cliente já ver o carrossel) */
  firstBaseDurationMs?: number;
}

const EASE = [0.32, 0.72, 0, 1] as const;
const SLIDE_DURATION = 0.55;

function AdSlide({ ad, onPress }: { ad: HomeAd; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="relative w-full h-full text-left rounded-xl overflow-hidden bg-card active:scale-[0.99] transition-transform"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
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
            "linear-gradient(90deg, hsl(0 0% 0% / 0.9) 0%, hsl(0 0% 0% / 0.78) 55%, hsl(0 0% 0% / 0.25) 100%)",
        }}
      />

      <div className="relative h-full w-full flex flex-col justify-center px-4 py-3">
        <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/55">
          {ad.eyebrow}
        </p>
        <p className="mt-1 pr-16 text-primary-foreground font-semibold text-[15px] leading-tight tracking-tight line-clamp-2">
          {ad.titulo}
        </p>
        {ad.descricao ? (
          <p className="mt-1 pr-16 text-[11px] leading-snug text-primary-foreground/65 line-clamp-1">
            {ad.descricao}
          </p>
        ) : null}
      </div>

      {/* CTA minimalista no canto */}
      <span className="absolute bottom-2.5 right-3 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary-foreground/90">
        {ad.ctaLabel}
        <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

/**
 * Carrossel suave entre o card de fidelidade e os anúncios da barbearia/app.
 * O card base fica sempre montado (define altura e nunca "some" da home).
 */
export function HomeAdRotator({
  children,
  ads,
  baseDurationMs = 5000,
  adDurationMs = 5500,
  firstBaseDurationMs = 2000,
}: HomeAdRotatorProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [loops, setLoops] = useState(0);
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
    setLoops(0);
  }, [ads.length, hasBase]);

  useEffect(() => {
    // Reduced motion must disable only the movement, not the content rotation.
    if (total <= 1 || paused) return;
    const isBase = hasBase && index === 0;
    const delay = isBase
      ? loops === 0
        ? firstBaseDurationMs
        : baseDurationMs
      : adDurationMs;
    timer.current = setTimeout(() => {
      setIndex((i) => {
        const next = (i + 1) % total;
        if (next === 0) setLoops((l) => l + 1);
        return next;
      });
    }, delay);
    return () => clearTimeout(timer.current);
  }, [index, loops, total, paused, hasBase, baseDurationMs, adDurationMs, firstBaseDurationMs]);

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
  const duration = reducedMotion ? 0 : SLIDE_DURATION;

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* Card base sempre montado — mantém a altura estável */}
      {hasBase ? (
        <motion.div
          animate={
            reducedMotion
              ? { opacity: currentAd ? 0 : 1 }
              : { x: currentAd ? "-22%" : "0%", opacity: currentAd ? 0 : 1 }
          }
          transition={{ duration, ease: EASE }}
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
            initial={reducedMotion ? { opacity: 0 } : { x: "100%", opacity: 0 }}
            animate={{ x: "0%", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { x: "-22%", opacity: 0 }}
            transition={{ duration, ease: EASE }}
            className="absolute inset-0"
          >
            <AdSlide ad={currentAd} onPress={() => handleAdPress(currentAd)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
