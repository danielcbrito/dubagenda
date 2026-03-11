import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import orbitCalendar from "@/assets/orbit-calendar.png";
import orbitSparkle from "@/assets/orbit-sparkle.png";
import orbitClipper from "@/assets/orbit-clipper.png";
import orbitScissors from "@/assets/orbit-scissors.png";
import orbitBarberPole from "@/assets/orbit-barberpole.png";
import orbitTicket from "@/assets/orbit-ticket.png";

import avatarBeanie from "@/assets/avatar-beanie.png";
import avatarGlassesGirl from "@/assets/avatar-glasses-girl.png";
import avatarElderly from "@/assets/avatar-elderly.png";
import avatarHijab from "@/assets/avatar-hijab.png";
import avatarBraids from "@/assets/avatar-braids.png";

/* ─── Spiral path generator ──────────────────────────────────
   Creates an Archimedean spiral from the outside inward.
   The spiral starts beyond the container edge and coils
   toward the centre like a spring. */
function buildSpiralPath(
  cx: number,
  cy: number,
  startR: number,
  endR: number,
  totalTurns: number,
  points = 200,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const angle = t * totalTurns * Math.PI * 2;
    const r = startR + (endR - startR) * t;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    parts.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }
  return parts.join(" ");
}

/* ─── Spiral configuration ───────────────────────────────── */
const CX = 220;
const CY = 240;

const spirals = [
  { startR: 250, endR: 52, turns: 3.2, opacity: 0.18 },
  { startR: 230, endR: 48, turns: 2.8, opacity: 0.12, rotate: 120 },
  { startR: 240, endR: 50, turns: 3.0, opacity: 0.10, rotate: 240 },
];

/* ─── Items placed along the spiral paths ─────────────────── */
interface SpiralItem {
  src: string;
  /** 0-1 position along spiral (0 = outer edge, 1 = centre) */
  t: number;
  spiralIdx: number;
  size: number;
  isAvatar?: boolean;
  avatarBg?: string;
  bobDelay?: number;
}

const spiralItems: SpiralItem[] = [
  // Large barber tools on outer parts
  { src: orbitScissors, t: 0.08, spiralIdx: 0, size: 64, bobDelay: 0 },
  { src: orbitClipper, t: 0.18, spiralIdx: 0, size: 60, bobDelay: 0.5 },
  { src: avatarGlassesGirl, t: 0.32, spiralIdx: 0, size: 52, isAvatar: true, avatarBg: "hsl(0 78% 45%)", bobDelay: 0.3 },
  { src: orbitBarberPole, t: 0.50, spiralIdx: 0, size: 54, bobDelay: 1.2 },
  // Second spiral arm
  { src: avatarBraids, t: 0.12, spiralIdx: 1, size: 50, isAvatar: true, avatarBg: "hsl(0 0% 20%)", bobDelay: 0.9 },
  { src: orbitCalendar, t: 0.28, spiralIdx: 1, size: 58, bobDelay: 1.8 },
  { src: avatarHijab, t: 0.45, spiralIdx: 1, size: 46, isAvatar: true, avatarBg: "hsl(0 50% 60%)", bobDelay: 1.5 },
  // Third spiral arm
  { src: avatarBeanie, t: 0.10, spiralIdx: 2, size: 48, isAvatar: true, avatarBg: "hsl(0 78% 50%)", bobDelay: 2.0 },
  { src: orbitTicket, t: 0.30, spiralIdx: 2, size: 44, bobDelay: 1.0 },
  { src: avatarElderly, t: 0.48, spiralIdx: 2, size: 42, isAvatar: true, avatarBg: "hsl(0 0% 30%)", bobDelay: 0.4 },
];

/** Given a spiral config and a 0-1 parameter, return the (x,y) position */
function posOnSpiral(
  spiralIdx: number,
  t: number,
): { x: number; y: number } {
  const s = spirals[spiralIdx];
  const angle = t * s.turns * Math.PI * 2;
  const r = s.startR + (s.endR - s.startR) * t;
  // Apply rotation offset
  const rotRad = ((s.rotate || 0) * Math.PI) / 180;
  const x = CX + r * Math.cos(angle + rotRad);
  const y = CY + r * Math.sin(angle + rotRad);
  return { x, y };
}

/* ─── OrbitSystem ─────────────────────────────────────────── */
const OrbitSystem = () => (
  <div className="relative w-[440px] h-[480px] mx-auto" style={{ marginLeft: "calc(50% - 220px)" }}>
    {/* SVG spiral paths */}
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 440 480"
      fill="none"
    >
      {spirals.map((s, i) => {
        const rotRad = ((s.rotate || 0) * Math.PI) / 180;
        // Build path with rotation applied
        const parts: string[] = [];
        const pts = 250;
        for (let j = 0; j <= pts; j++) {
          const t = j / pts;
          const angle = t * s.turns * Math.PI * 2 + rotRad;
          const r = s.startR + (s.endR - s.startR) * t;
          const x = CX + r * Math.cos(angle);
          const y = CY + r * Math.sin(angle);
          parts.push(j === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`);
        }
        return (
          <path
            key={i}
            d={parts.join(" ")}
            stroke={`hsl(0 0% 45% / ${s.opacity})`}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>

    {/* Center sparkle — the "star" */}
    <div
      className="absolute z-10"
      style={{
        left: CX - 52,
        top: CY - 52,
        width: 104,
        height: 104,
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="w-full h-full"
      >
        <img src={orbitSparkle} alt="" className="w-full h-full object-contain drop-shadow-lg" />
      </motion.div>
    </div>

    {/* Items on spirals */}
    {spiralItems.map((item, i) => {
      const pos = posOnSpiral(item.spiralIdx, item.t);
      return (
        <motion.div
          key={i}
          className="absolute z-20"
          style={{
            left: pos.x - item.size / 2,
            top: pos.y - item.size / 2,
            width: item.size,
            height: item.size,
          }}
          animate={{ y: [0, -6, 0, 6, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: item.bobDelay || 0,
          }}
        >
          {item.isAvatar ? (
            <div
              className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{
                background: item.avatarBg,
                boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
              }}
            >
              <img
                src={item.src}
                alt=""
                className="w-[85%] h-[85%] object-cover rounded-full"
              />
            </div>
          ) : (
            <img
              src={item.src}
              alt=""
              className="w-full h-full object-contain"
              style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.12))" }}
            />
          )}
        </motion.div>
      );
    })}
  </div>
);

/* ─── Page ─────────────────────────────────────────────────── */
const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 10% 0%, hsl(0 78% 45% / 0.18) 0%, transparent 45%),
          radial-gradient(ellipse at 90% 0%, hsl(0 0% 12% / 0.15) 0%, transparent 45%),
          radial-gradient(ellipse at 50% 40%, hsl(0 0% 94%) 0%, transparent 60%),
          radial-gradient(ellipse at 30% 90%, hsl(0 78% 45% / 0.10) 0%, transparent 45%),
          radial-gradient(ellipse at 80% 85%, hsl(0 0% 15% / 0.08) 0%, transparent 45%),
          hsl(0 0% 95%)
        `,
      }}
    >
      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Orbital system — takes up more vertical space */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0"
          >
            <OrbitSystem />
          </motion.div>

          {/* Spacer */}
          <div className="flex-1 min-h-2" />

          {/* Text + Button block — closely grouped at bottom */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            {/* Subtitle — lighter, tracked */}
            <p
              className="text-[12px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: "hsl(0 0% 45%)" }}
            >
              DUB Agenda
            </p>

            {/* Main headline — mixed weights for human feel */}
            <h1
              className="text-[44px] leading-[1.05] tracking-tight"
              style={{ color: "hsl(0 0% 8%)" }}
            >
              <span className="font-extralight">Seu </span>
              <span className="font-normal italic" style={{ fontFamily: "'Nunito', sans-serif" }}>
                Estilo
              </span>
            </h1>
            <h1 className="text-[44px] leading-[1.05] tracking-tight">
              <span
                className="font-semibold"
                style={{
                  background: "linear-gradient(90deg, hsl(0 78% 45%) 0%, hsl(0 0% 10%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Começa Aqui
              </span>
            </h1>
          </motion.div>

          {/* CTA button — right below title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full mt-6 mb-6"
          >
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="w-full active:scale-[0.97] transition-transform duration-150"
              style={{
                height: 44,
                borderRadius: 50,
                background: "hsl(0 0% 8%)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span
                className="text-[14px] font-semibold tracking-wide"
                style={{ color: "hsl(0 0% 98%)" }}
              >
                Encontrar Barbearias
              </span>
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
