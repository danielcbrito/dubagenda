import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
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

const EASE = [0.22, 1, 0.36, 1] as const;
const SLIDE_DURATION = 0.85;

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
          decoding="sync"
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
            "linear-gradient(90deg, hsl(0 0% 0% / 0.94) 0%, hsl(0 0% 0% / 0.88) 48%, hsl(0 0% 0% / 0.55) 78%, hsl(0 0% 0% / 0.35) 100%)",
        }}
      />

      <div className="relative h-full w-full flex flex-col justify-center px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/75">
          {ad.eyebrow}
        </p>
        <p className="mt-1.5 pr-20 text-primary-foreground font-bold text-[17px] leading-[1.15] tracking-tight line-clamp-2">
          {ad.titulo}
        </p>
        {ad.descricao ? (
          <p className="mt-1 pr-20 text-[12px] leading-snug text-primary-foreground/85 line-clamp-1">
            {ad.descricao}
          </p>
        ) : null}
      </div>

      {/* CTA minimalista no canto */}
      <span className="absolute bottom-2.5 right-3 inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary-foreground">
        {ad.ctaLabel}
        <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

/**
 * Carrossel suave entre o card de fidelidade e os anúncios da barbearia/app.
 * O trilho se move sempre para a frente; ao chegar no final, um clone do
 * primeiro slide permite o loop contínuo sem "voltar" visualmente.
 */
export function HomeAdRotator({
  children,
  ads,
  baseDurationMs = 6500,
  adDurationMs = 7000,
  firstBaseDurationMs = 3500,
}: HomeAdRotatorProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [loops, setLoops] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const hasBase = !!children;

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Pré-carrega as imagens: um anúncio só entra na fila depois de estar pronto,
  // evitando o "flash" de card carregando na entrada do app.
  useEffect(() => {
    let alive = true;
    ads.forEach((ad) => {
      if (!ad.imageUrl) {
        setReadyIds((prev) => (prev.includes(ad.id) ? prev : [...prev, ad.id]));
        return;
      }
      const img = new Image();
      img.decoding = "async";
      img.src = ad.imageUrl;
      const done = () => {
        if (!alive) return;
        setReadyIds((prev) => (prev.includes(ad.id) ? prev : [...prev, ad.id]));
      };
      if (img.complete) done();
      else {
        img.onload = done;
        img.onerror = done;
      }
    });
    return () => {
      alive = false;
    };
  }, [ads]);

  const visibleAds = useMemo(
    () => ads.filter((ad) => readyIds.includes(ad.id)),
    [ads, readyIds],
  );

  // slides: 0 = base (se existir) | demais = anúncios | último = clone do primeiro
  // para permitir loop infinito sempre avançando para a frente.
  const itemCount = hasBase ? visibleAds.length + 1 : visibleAds.length;
  const totalSlides = itemCount > 1 ? itemCount + 1 : itemCount;

  useEffect(() => {
    setIndex(0);
    setLoops(0);
    setIsResetting(false);
  }, [visibleAds.length, hasBase]);

  useEffect(() => {
    if (totalSlides <= 1 || paused || isResetting) return;
    const isBase = hasBase && (index === 0 || index === totalSlides - 1);
    const delay = isBase
      ? loops === 0 && index === 0
        ? firstBaseDurationMs
        : baseDurationMs
      : adDurationMs;
    timer.current = setTimeout(() => {
      setIndex((i) => {
        const next = i + 1;
        if (next >= totalSlides) {
          // Chegou no clone do primeiro slide; reseta silenciosamente para o
          // slide original sem animação, mantendo a sensação de movimento contínuo.
          setIsResetting(true);
          setLoops((l) => l + 1);
          return 0;
        }
        return next;
      });
    }, delay);
    return () => clearTimeout(timer.current);
  }, [
    index,
    loops,
    totalSlides,
    paused,
    isResetting,
    hasBase,
    baseDurationMs,
    adDurationMs,
    firstBaseDurationMs,
  ]);

  // Sai do estado de reset no próximo frame para reativar as transições.
  useEffect(() => {
    if (!isResetting) return;
    const raf = requestAnimationFrame(() => setIsResetting(false));
    return () => cancelAnimationFrame(raf);
  }, [isResetting]);

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

  if (totalSlides === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <motion.div
        className="flex w-full items-stretch"
        animate={{ x: `-${index * 100}%` }}
        transition={
          isResetting || reducedMotion
            ? { duration: 0 }
            : { duration: SLIDE_DURATION, ease: EASE }
        }
        style={{ willChange: "transform" }}
      >
        {hasBase ? (
          <div className="w-full shrink-0">{children}</div>
        ) : null}

        {visibleAds.map((ad) => (
          <div
            key={ad.id}
            className={hasBase ? "w-full shrink-0" : "w-full shrink-0 h-[104px]"}
          >
            <AdSlide ad={ad} onPress={() => handleAdPress(ad)} />
          </div>
        ))}

        {/* Clone do primeiro slide para loop infinito sempre à frente */}
        {itemCount > 1 && hasBase ? (
          <div className="w-full shrink-0">{children}</div>
        ) : null}
        {itemCount > 1 && !hasBase && visibleAds[0] ? (
          <div
            key={`${visibleAds[0].id}-clone`}
            className="w-full shrink-0 h-[104px]"
          >
            <AdSlide ad={visibleAds[0]} onPress={() => handleAdPress(visibleAds[0])} />
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
