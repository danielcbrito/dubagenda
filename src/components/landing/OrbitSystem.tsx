import { motion } from "framer-motion";

import orbitCrown from "@/assets/orbit-crown.png";
import orbitSparkle from "@/assets/orbit-sparkle.png";
import orbitFire from "@/assets/orbit-fire.png";
import orbitDiamond from "@/assets/orbit-diamond.png";
import orbitSunglasses from "@/assets/orbit-sunglasses.png";
import orbitStar from "@/assets/orbit-star.png";
import orbitPeace from "@/assets/orbit-peace.png";
import orbitCalendar from "@/assets/orbit-calendar.png";

import avatarBeanie from "@/assets/avatar-beanie.png";
import avatarGlassesGirl from "@/assets/avatar-glasses-girl.png";
import avatarElderly from "@/assets/avatar-elderly.png";
import avatarHijab from "@/assets/avatar-hijab.png";
import avatarBraids from "@/assets/avatar-braids.png";

/* ─── Configuration ──────────────────────────────────────── */
const CX = 200;
const CY = 200;
const VIEW = 400;

/** Concentric elliptical orbits — clean circles like Luma */
const orbits = [
  { rx: 170, ry: 170, opacity: 0.14, strokeWidth: 1 },
  { rx: 120, ry: 120, opacity: 0.10, strokeWidth: 1 },
];

interface OrbitItem {
  src: string;
  orbit: number;
  angle: number;
  size: number;
  isAvatar?: boolean;
  avatarBg?: string;
  bobDelay?: number;
  radiusOffset?: number;
}

/*
  Client-focused icons — each represents the CLIENT experience:
  👑 Crown → "saia se sentindo rei"
  🔥 Fire → "visual que tá pegando fogo"
  💎 Diamond → "experiência premium"
  🕶️ Sunglasses → "estilo e atitude"
  ⭐ Star → "brilho e destaque"
  ✌️ Peace → "confiança e boa vibe"
  📅 Calendar → "praticidade de agendar"
*/
const orbitItems: OrbitItem[] = [
  // Outer orbit — lifestyle icons & avatars alternating
  { src: orbitCrown,        orbit: 0, angle: 25,   size: 56, bobDelay: 0 },
  { src: avatarBeanie,      orbit: 0, angle: 80,   size: 50, isAvatar: true, avatarBg: "hsl(20 80% 60%)", bobDelay: 0.4 },
  { src: orbitFire,         orbit: 0, angle: 140,  size: 52, bobDelay: 1.0 },
  { src: avatarGlassesGirl, orbit: 0, angle: 195,  size: 52, isAvatar: true, avatarBg: "hsl(45 70% 55%)", bobDelay: 0.8 },
  { src: orbitSunglasses,   orbit: 0, angle: 250,  size: 54, bobDelay: 1.6, radiusOffset: 10 },
  { src: avatarBraids,      orbit: 0, angle: 320,  size: 48, isAvatar: true, avatarBg: "hsl(280 40% 60%)", bobDelay: 1.2 },

  // Inner orbit — more personal, intimate icons
  { src: orbitCalendar,     orbit: 1, angle: 10,   size: 54, bobDelay: 0.2 },
  { src: avatarElderly,     orbit: 1, angle: 100,  size: 44, isAvatar: true, avatarBg: "hsl(140 40% 50%)", bobDelay: 0.6 },
  { src: orbitDiamond,      orbit: 1, angle: 180,  size: 48, bobDelay: 1.4 },
  { src: avatarHijab,       orbit: 1, angle: 260,  size: 46, isAvatar: true, avatarBg: "hsl(200 50% 60%)", bobDelay: 1.0 },
];

function getPosition(item: OrbitItem): { x: number; y: number } {
  const o = orbits[item.orbit];
  const rad = (item.angle * Math.PI) / 180;
  const rx = o.rx + (item.radiusOffset || 0);
  const ry = o.ry + (item.radiusOffset || 0);
  return {
    x: CX + rx * Math.cos(rad),
    y: CY + ry * Math.sin(rad),
  };
}

/** Clean orbital system — client-experience focused */
export function OrbitSystem() {
  return (
    <div
      className="relative mx-auto"
      style={{ width: VIEW, height: VIEW, marginLeft: `calc(50% - ${VIEW / 2}px)` }}
    >
      {/* SVG orbit rings */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        fill="none"
      >
        {orbits.map((o, i) => (
          <ellipse
            key={i}
            cx={CX}
            cy={CY}
            rx={o.rx}
            ry={o.ry}
            stroke={`hsl(0 0% 55% / ${o.opacity})`}
            strokeWidth={o.strokeWidth}
          />
        ))}
      </svg>

      {/* Center sparkle — the "you" star */}
      <div
        className="absolute z-10"
        style={{
          left: CX - 44,
          top: CY - 44,
          width: 88,
          height: 88,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full"
        >
          <img
            src={orbitSparkle}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
          />
        </motion.div>
      </div>

      {/* Floating items on orbits */}
      {orbitItems.map((item, i) => {
        const pos = getPosition(item);
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
            animate={{ y: [0, -5, 0, 5, 0] }}
            transition={{
              duration: 3.5,
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
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
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
                style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.10))" }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
