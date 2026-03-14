import { motion } from "framer-motion";

import orbitCrown from "@/assets/orbit-crown.png";
import orbitSparkle from "@/assets/orbit-sparkle.png";
import orbitFire from "@/assets/orbit-fire.png";
import orbitDiamond from "@/assets/orbit-diamond.png";
import orbitSunglasses from "@/assets/orbit-sunglasses.png";
import orbitCalendar from "@/assets/orbit-calendar.png";

import avatarBeanie from "@/assets/avatar-beanie.png";
import avatarGlassesGirl from "@/assets/avatar-glasses-girl.png";
import avatarElderly from "@/assets/avatar-elderly.png";
import avatarHijab from "@/assets/avatar-hijab.png";
import avatarBraids from "@/assets/avatar-braids.png";

/* ─── Configuration ──────────────────────────────────────── */
const CX = 170;
const CY = 170;
const VIEW = 340;

/**
 * Three concentric orbits — outer is aspirational, middle is social,
 * inner is intimate. Opacity decreases inward for depth.
 */
const orbits = [
  { rx: 150, ry: 150, opacity: 0.08, strokeWidth: 1, dashArray: "3 6" },
  { rx: 105, ry: 105, opacity: 0.06, strokeWidth: 1, dashArray: "2 8" },
];

interface OrbitItem {
  src: string;
  orbit: number;
  angle: number;
  size: number;
  isAvatar?: boolean;
  avatarBg?: string;
  avatarRing?: string;
  bobDelay?: number;
  radiusOffset?: number;
}

/*
  STRATEGIC ICON PLACEMENT — Psychological triggers:
  
  👑 Crown (top-right)    → Status & aspiration — "you deserve the best"
  🔥 Fire (left)          → Urgency & desire — "your style is fire"  
  🕶️ Sunglasses (bottom)  → Confidence & cool — "own your look"
  💎 Diamond (inner)      → Premium quality — "luxury experience"
  📅 Calendar (inner-top) → Convenience — "effortless scheduling"
  
  Avatars placed between icons = social proof ("people like you use this")
*/
const orbitItems: OrbitItem[] = [
  // Outer orbit — aspiration + social proof alternating
  { src: orbitCrown,        orbit: 0, angle: 30,   size: 46, bobDelay: 0 },
  { src: avatarBeanie,      orbit: 0, angle: 95,   size: 42, isAvatar: true, avatarBg: "hsl(15 70% 65%)", avatarRing: "hsl(15 70% 80%)", bobDelay: 0.5 },
  { src: orbitFire,         orbit: 0, angle: 155,  size: 42, bobDelay: 1.2 },
  { src: avatarGlassesGirl, orbit: 0, angle: 215,  size: 42, isAvatar: true, avatarBg: "hsl(40 60% 60%)", avatarRing: "hsl(40 60% 78%)", bobDelay: 0.9 },
  { src: orbitSunglasses,   orbit: 0, angle: 275,  size: 44, bobDelay: 1.8 },
  { src: avatarBraids,      orbit: 0, angle: 335,  size: 40, isAvatar: true, avatarBg: "hsl(270 35% 62%)", avatarRing: "hsl(270 35% 78%)", bobDelay: 1.4 },

  // Inner orbit — intimacy + trust
  { src: orbitCalendar,     orbit: 1, angle: 0,    size: 44, bobDelay: 0.3 },
  { src: avatarElderly,     orbit: 1, angle: 120,  size: 38, isAvatar: true, avatarBg: "hsl(145 35% 55%)", avatarRing: "hsl(145 35% 72%)", bobDelay: 0.7 },
  { src: orbitDiamond,      orbit: 1, angle: 240,  size: 40, bobDelay: 1.6 },
  { src: avatarHijab,       orbit: 1, angle: 180,  size: 36, isAvatar: true, avatarBg: "hsl(200 45% 58%)", avatarRing: "hsl(200 45% 75%)", bobDelay: 1.1 },
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

/** Premium orbital system — psychologically strategic placement */
export function OrbitSystem() {
  return (
    <div
      className="relative mx-auto"
      style={{ width: VIEW, height: VIEW }}
    >
      {/* SVG orbit rings — dashed for elegance */}
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
            stroke={`hsl(0 0% 45% / ${o.opacity})`}
            strokeWidth={o.strokeWidth}
            strokeDasharray={o.dashArray}
          />
        ))}
      </svg>

      {/* Center sparkle — "YOU are the center of everything" */}
      <div
        className="absolute z-10"
        style={{
          left: CX - 36,
          top: CY - 36,
          width: 72,
          height: 72,
        }}
      >
        {/* Soft glow behind center */}
        <div
          className="absolute inset-[-20px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(0 78% 45% / 0.06) 0%, transparent 70%)",
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.06, 1], rotate: [0, 3, -3, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full relative"
        >
          <img
            src={orbitSparkle}
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.08))" }}
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
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -4, 0, 4, 0],
            }}
            transition={{
              opacity: { duration: 0.5, delay: 0.3 + i * 0.08 },
              scale: { duration: 0.5, delay: 0.3 + i * 0.08 },
              y: {
                duration: 4 + (i % 3) * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: item.bobDelay || 0,
              },
            }}
          >
            {item.isAvatar ? (
              <div
                className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  background: item.avatarBg,
                  boxShadow: `0 4px 16px rgba(0,0,0,0.10), 0 0 0 2px ${item.avatarRing || "transparent"}`,
                }}
              >
                <img
                  src={item.src}
                  alt=""
                  className="w-[82%] h-[82%] object-cover rounded-full"
                />
              </div>
            ) : (
              <img
                src={item.src}
                alt=""
                className="w-full h-full object-contain"
                style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.08))" }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
