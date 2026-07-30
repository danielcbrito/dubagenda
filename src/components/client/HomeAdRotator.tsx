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
const SLIDE_DURATION = 0.7;
const GAP = 12;

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
 * Todos os slides ficam num "trilho" horizontal, então a troca é contínua
 * (sem gap de saída/entrada) e a imagem já entra pré-carregada.
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
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // slides: 0 = base (se existir) | demais = anúncios
  const total = (hasBase ? 1 : 0) + visibleAds.length;

  useEffect(() => {
    setIndex(0);
    setLoops(0);
  }, [visibleAds.length, hasBase]);

  useEffect(() => {
    // Reduced motion desativa só o movimento, nunca a rotação do conteúdo.
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
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

  const slides = useMemo(
    () => [
      ...(hasBase ? [{ key: "__base__", node: children }] : []),
      ...visibleAds.map((ad) => ({
        key: ad.id,
        node: <AdSlide ad={ad} onPress={() => handleAdPress(ad)} />,
      })),
    ],
    [hasBase, children, visibleAds, handleAdPress],
  );

  if (total === 0) return null;

  const goTo = (i: number) => {
    const next = ((i % total) + total) % total;
    setIndex(next);
  };

  const step = width + GAP;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <motion.div
        className="flex items-stretch"
        style={{ gap: GAP, willChange: "transform" }}
        animate={{ x: -index * step }}
        drag={total > 1 ? "x" : false}
        dragElastic={0.12}
        dragConstraints={{ left: -(total - 1) * step, right: 0 }}
        onDragStart={() => setPaused(true)}
        onDragEnd={(_, info) => {
          const threshold = Math.min(80, width * 0.22);
          if (info.offset.x < -threshold || info.velocity.x < -450) goTo(index + 1);
          else if (info.offset.x > threshold || info.velocity.x > 450) goTo(index - 1);
          setPaused(false);
        }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 34, mass: 0.9 }
        }
      >
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <motion.div
              key={slide.key}
              className={hasBase ? "shrink-0" : "shrink-0 h-[104px]"}
              style={{ width: width || "100%" }}
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : { scale: active ? 1 : 0.94, opacity: active ? 1 : 0.55 }
              }
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 34, mass: 0.9 }
              }
            >
              {slide.node}
            </motion.div>
          );
        })}
      </motion.div>

      {total > 1 && (
        <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
          {slides.map((slide, i) => (
            <span
              key={slide.key}
              className="rounded-full bg-foreground/25 transition-all duration-300"
              style={{
                width: i === index ? 10 : 4,
                height: 4,
                backgroundColor:
                  i === index ? "hsl(var(--foreground) / 0.55)" : undefined,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
