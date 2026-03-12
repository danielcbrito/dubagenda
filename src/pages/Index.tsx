import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SlimPillButton } from "@/components/landing/SlimPillButton";

/* ─── Minimal line-art SVG illustrations ──────────────────── */

const ScissorsArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="48" r="7" />
    <circle cx="46" cy="48" r="7" />
    <path d="M24 44 L38 20" />
    <path d="M40 44 L26 20" />
    <path d="M26 20 L32 10" />
    <path d="M38 20 L32 10" />
  </svg>
);

const FreshCutArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 38 Q20 18 32 14 Q44 18 44 38" />
    <path d="M22 38 Q22 46 32 50 Q42 46 42 38" />
    <path d="M18 26 Q18 12 32 8 Q46 12 46 26" strokeDasharray="2 3" opacity="0.5" />
    <line x1="28" y1="34" x2="28" y2="34.5" strokeWidth="2.5" />
    <line x1="36" y1="34" x2="36" y2="34.5" strokeWidth="2.5" />
    <path d="M29 40 Q32 42 35 40" />
  </svg>
);

const BeardArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 24 Q16 14 32 10 Q48 14 48 24" />
    <path d="M16 24 L16 34 Q16 52 32 56 Q48 52 48 34 L48 24" />
    <path d="M24 32 Q28 36 32 32 Q36 36 40 32" opacity="0.4" />
  </svg>
);

const CombArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
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

const BarberPoleArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="24" y="8" width="16" height="48" rx="8" />
    <path d="M24 16 L40 28" opacity="0.35" />
    <path d="M24 24 L40 36" opacity="0.35" />
    <path d="M24 32 L40 44" opacity="0.35" />
    <path d="M24 40 L40 52" opacity="0.35" />
    <circle cx="32" cy="8" r="3" />
  </svg>
);

const RazorArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 46 L32 14" />
    <path d="M32 14 L38 12 L40 18 L32 14" />
    <path d="M18 46 L14 50 L20 52 L18 46" />
    <line x1="24" y1="32" x2="36" y2="28" opacity="0.3" />
  </svg>
);

const MapPinArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M32 56 C32 56 48 38 48 26 C48 17 41 10 32 10 C23 10 16 17 16 26 C16 38 32 56 32 56Z" />
    <circle cx="32" cy="26" r="6" />
  </svg>
);

const CalendarArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="12" y="16" width="40" height="38" rx="4" />
    <line x1="12" y1="26" x2="52" y2="26" />
    <line x1="22" y1="10" x2="22" y2="20" />
    <line x1="42" y1="10" x2="42" y2="20" />
    <circle cx="26" cy="36" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="32" cy="36" r="2" fill="currentColor" opacity="0.6" />
    <circle cx="38" cy="36" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="26" cy="44" r="2" fill="currentColor" opacity="0.3" />
    <circle cx="32" cy="44" r="2" fill="currentColor" opacity="0.3" />
  </svg>
);

const SparkleArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="currentColor" stroke="none">
    <path d="M16 2 L18 13 L29 16 L18 19 L16 30 L14 19 L3 16 L14 13 Z" opacity="0.55" />
  </svg>
);

const StarArt = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M32 10 L36 24 L50 24 L38 32 L42 46 L32 38 L22 46 L26 32 L14 24 L28 24 Z" />
  </svg>
);

/* ─── Floating items layout ───────────────────────────────── */
interface FloatingItem {
  Component: React.FC<{ className?: string }>;
  x: string;
  y: string;
  size: number;
  rotate?: number;
  delay: number;
  opacity: number;
}

const floatingItems: FloatingItem[] = [
  // Top row — scattered across top
  { Component: ScissorsArt,   x: "6%",   y: "4%",   size: 48, rotate: -20, delay: 0,    opacity: 0.22 },
  { Component: MapPinArt,     x: "40%",  y: "2%",   size: 42, rotate: 8,   delay: 0.3,  opacity: 0.20 },
  { Component: FreshCutArt,   x: "72%",  y: "5%",   size: 54, rotate: 5,   delay: 0.15, opacity: 0.20 },
  
  // Second row
  { Component: SparkleArt,    x: "28%",  y: "14%",  size: 16, delay: 0.5,  opacity: 0.28 },
  { Component: CalendarArt,   x: "80%",  y: "18%",  size: 40, rotate: -5,  delay: 0.6,  opacity: 0.18 },
  { Component: SparkleArt,    x: "10%",  y: "20%",  size: 12, delay: 0.8,  opacity: 0.24 },
  
  // Middle area
  { Component: BarberPoleArt, x: "2%",   y: "28%",  size: 44, rotate: 12,  delay: 0.4,  opacity: 0.19 },
  { Component: CombArt,       x: "60%",  y: "26%",  size: 46, rotate: -30, delay: 0.7,  opacity: 0.17 },
  { Component: SparkleArt,    x: "48%",  y: "32%",  size: 14, delay: 1.0,  opacity: 0.26 },
  
  // Lower middle
  { Component: BeardArt,      x: "18%",  y: "38%",  size: 44, rotate: -8,  delay: 0.5,  opacity: 0.18 },
  { Component: RazorArt,      x: "72%",  y: "36%",  size: 38, rotate: 25,  delay: 0.9,  opacity: 0.16 },
  { Component: StarArt,       x: "42%",  y: "42%",  size: 32, rotate: 15,  delay: 0.35, opacity: 0.20 },
  { Component: SparkleArt,    x: "88%",  y: "42%",  size: 13, delay: 1.2,  opacity: 0.22 },
  
  // Bottom scatter
  { Component: FreshCutArt,   x: "4%",   y: "50%",  size: 40, rotate: 10,  delay: 0.65, opacity: 0.15 },
  { Component: MapPinArt,     x: "55%",  y: "52%",  size: 36, rotate: -12, delay: 0.45, opacity: 0.16 },
  { Component: SparkleArt,    x: "30%",  y: "55%",  size: 11, delay: 0.2,  opacity: 0.22 },
  { Component: ScissorsArt,   x: "82%",  y: "54%",  size: 36, rotate: 30,  delay: 1.1,  opacity: 0.14 },
];

/* ─── Page ─────────────────────────────────────────────────── */
const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "hsl(0 0% 97%)" }}
    >
      {/* Noise */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Color washes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 50% 40% at 20% 12%, hsl(0 55% 50% / 0.06) 0%, transparent 100%),
            radial-gradient(ellipse 40% 35% at 80% 60%, hsl(25 50% 45% / 0.04) 0%, transparent 100%)
          `,
        }}
      />

      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-7 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">


          {/* Illustration area — fills most of the screen */}
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
                    color: "hsl(0 0% 18%)",
                    transform: `rotate(${item.rotate ?? 0}deg)`,
                  }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{
                    opacity: item.opacity,
                    scale: 1,
                    y: [0, -3, 0, 3, 0],
                  }}
                  transition={{
                    opacity: { duration: 0.5, delay: item.delay },
                    scale: { duration: 0.5, delay: item.delay },
                    y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: item.delay },
                  }}
                >
                  <Component className="w-full h-full" />
                </motion.div>
              );
            })}
          </div>

          {/* Bottom section — brand + title + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 flex flex-col items-center gap-5 mb-4"
          >
            {/* Brand label */}
            <div className="flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-primary" />
              <span className="text-[11px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
                DUB Agenda
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-[28px] leading-[1.15] tracking-[-0.01em] font-medium text-center text-foreground"
            >
              Encontre seu{" "}
              <span
                className="font-bold italic"
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  background: "linear-gradient(135deg, hsl(0 72% 48%) 0%, hsl(18 55% 38%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Barbeiro Ideal
              </span>
            </h1>

            {/* CTA */}
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
