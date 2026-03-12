import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SlimPillButton } from "@/components/landing/SlimPillButton";

/* ─── Minimal line-art SVG illustrations ──────────────────── */

/** Scissors — thin elegant line drawing */
const ScissorsArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="48" r="7" />
    <circle cx="46" cy="48" r="7" />
    <path d="M24 44 L38 20" />
    <path d="M40 44 L26 20" />
    <path d="M26 20 L32 10" />
    <path d="M38 20 L32 10" />
  </svg>
);

/** Face silhouette with fresh fade haircut */
const FreshCutArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 38 Q20 18 32 14 Q44 18 44 38" />
    <path d="M22 38 Q22 46 32 50 Q42 46 42 38" />
    <path d="M18 26 Q18 12 32 8 Q46 12 46 26" strokeDasharray="2 3" opacity="0.5" />
    <line x1="28" y1="34" x2="28" y2="34.5" strokeWidth="2" />
    <line x1="36" y1="34" x2="36" y2="34.5" strokeWidth="2" />
    <path d="M29 40 Q32 42 35 40" />
  </svg>
);

/** Beard outline — style symbol */
const BeardArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 24 Q16 14 32 10 Q48 14 48 24" />
    <path d="M16 24 L16 34 Q16 52 32 56 Q48 52 48 34 L48 24" />
    <path d="M24 32 Q28 36 32 32 Q36 36 40 32" opacity="0.4" />
  </svg>
);

/** Comb — classic barber tool, thin lines */
const CombArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <rect x="10" y="24" width="44" height="16" rx="3" />
    <line x1="16" y1="28" x2="16" y2="36" />
    <line x1="20" y1="28" x2="20" y2="36" />
    <line x1="24" y1="28" x2="24" y2="36" />
    <line x1="28" y1="28" x2="28" y2="36" />
    <line x1="32" y1="28" x2="32" y2="36" />
    <line x1="36" y1="28" x2="36" y2="36" />
    <line x1="40" y1="28" x2="40" y2="36" />
    <line x1="44" y1="28" x2="44" y2="36" />
    <line x1="48" y1="28" x2="48" y2="36" />
  </svg>
);

/** Barber pole — iconic symbol, line art */
const BarberPoleArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="24" y="8" width="16" height="48" rx="8" />
    <path d="M24 16 L40 28" opacity="0.35" />
    <path d="M24 24 L40 36" opacity="0.35" />
    <path d="M24 32 L40 44" opacity="0.35" />
    <path d="M24 40 L40 52" opacity="0.35" />
    <circle cx="32" cy="8" r="3" />
  </svg>
);

/** Star / sparkle — feeling fresh */
const SparkleArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="currentColor" stroke="none">
    <path d="M16 2 L18 13 L29 16 L18 19 L16 30 L14 19 L3 16 L14 13 Z" opacity="0.6" />
  </svg>
);

/* ─── Floating element config ─────────────────────────────── */
interface FloatingItem {
  Component: React.FC<{ className?: string }>;
  x: string; // CSS left
  y: string; // CSS top
  size: number;
  rotate?: number;
  delay: number;
  opacity?: number;
}

const floatingItems: FloatingItem[] = [
  { Component: ScissorsArt,   x: "8%",  y: "12%", size: 52, rotate: -15, delay: 0, opacity: 0.18 },
  { Component: FreshCutArt,   x: "68%", y: "8%",  size: 60, rotate: 5,   delay: 0.3, opacity: 0.16 },
  { Component: CombArt,       x: "75%", y: "32%", size: 44, rotate: 35,  delay: 0.8, opacity: 0.14 },
  { Component: BeardArt,      x: "12%", y: "38%", size: 48, rotate: -8,  delay: 0.5, opacity: 0.15 },
  { Component: BarberPoleArt, x: "55%", y: "48%", size: 40, rotate: 10,  delay: 1.0, opacity: 0.13 },
  { Component: SparkleArt,    x: "42%", y: "6%",  size: 18, delay: 0.2, opacity: 0.22 },
  { Component: SparkleArt,    x: "88%", y: "22%", size: 14, delay: 1.2, opacity: 0.18 },
  { Component: SparkleArt,    x: "22%", y: "52%", size: 16, delay: 0.7, opacity: 0.20 },
];

/* ─── Page ─────────────────────────────────────────────────── */
const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "hsl(0 0% 97%)" }}
    >
      {/* Noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Soft color wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 50% 40% at 25% 15%, hsl(0 55% 50% / 0.06) 0%, transparent 100%),
            radial-gradient(ellipse 40% 35% at 75% 70%, hsl(25 50% 45% / 0.04) 0%, transparent 100%)
          `,
        }}
      />

      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-7 pt-[calc(env(safe-area-inset-top,0px)+2rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">

          {/* Top brand */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="flex-shrink-0 flex items-center gap-2"
          >
            <div className="w-[5px] h-[5px] rounded-full" style={{ background: "hsl(0 72% 50%)" }} />
            <span
              className="text-[11px] font-medium tracking-[0.3em] uppercase"
              style={{ color: "hsl(0 0% 42%)" }}
            >
              DUB Agenda
            </span>
          </motion.div>

          {/* Floating illustrations area */}
          <div className="relative flex-1 min-h-0">
            {floatingItems.map((item, i) => {
              const { Component } = item;
              return (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.size,
                    height: item.size,
                    color: "hsl(0 0% 15%)",
                    opacity: item.opacity ?? 0.15,
                    transform: `rotate(${item.rotate ?? 0}deg)`,
                  }}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{
                    opacity: item.opacity ?? 0.15,
                    scale: 1,
                    y: [0, -4, 0, 4, 0],
                  }}
                  transition={{
                    opacity: { duration: 0.6, delay: item.delay },
                    scale: { duration: 0.6, delay: item.delay },
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: item.delay },
                  }}
                >
                  <Component className="w-full h-full" />
                </motion.div>
              );
            })}

            {/* Central headline — positioned in the visual center */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <h1
                className="text-[48px] leading-[0.95] tracking-[-0.03em] font-extralight text-center"
                style={{ color: "hsl(0 0% 10%)" }}
              >
                Seu
              </h1>
              <h1 className="text-[56px] leading-[0.95] tracking-[-0.03em] text-center mt-1">
                <span
                  className="font-semibold italic"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    background: "linear-gradient(135deg, hsl(0 72% 48%) 0%, hsl(20 55% 38%) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Estilo
                </span>
              </h1>
              <h1
                className="text-[48px] leading-[0.95] tracking-[-0.03em] font-medium text-center mt-1"
                style={{ color: "hsl(0 0% 10%)" }}
              >
                Começa Aqui<span style={{ color: "hsl(0 72% 48%)" }}>.</span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="text-[13px] leading-[1.5] font-normal mt-6 text-center max-w-[260px]"
                style={{ color: "hsl(0 0% 48%)" }}
              >
                Agende, cuide do visual e saia
                com a confiança que você merece.
              </motion.p>
            </motion.div>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 w-full flex justify-center mb-4"
          >
            <SlimPillButton
              label="Encontrar Barbearias"
              onClick={() => navigate("/escolher-barbearia")}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
