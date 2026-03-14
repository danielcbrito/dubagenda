import { motion } from "framer-motion";

/** Floating bokeh particles with staggered entrance */
const PARTICLES = [
  { top: "6%", left: "72%", size: 80, delay: 0.4, dur: 8, color: "primary" },
  { top: "38%", left: "3%", size: 120, delay: 0.8, dur: 10, color: "primary" },
  { top: "65%", left: "78%", size: 60, delay: 1.2, dur: 7, color: "gold" },
  { top: "18%", left: "88%", size: 40, delay: 1.5, dur: 9, color: "primary" },
  { top: "80%", left: "12%", size: 50, delay: 0.6, dur: 11, color: "gold" },
  { top: "50%", left: "50%", size: 140, delay: 1.0, dur: 12, color: "primary" },
];

const DOTS = [
  { top: "10%", left: "20%", s: 3, delay: 0.5 },
  { top: "30%", left: "85%", s: 2, delay: 0.9 },
  { top: "55%", left: "15%", s: 2.5, delay: 1.3 },
  { top: "75%", left: "60%", s: 2, delay: 1.1 },
  { top: "42%", left: "92%", s: 3, delay: 0.7 },
  { top: "88%", left: "35%", s: 2, delay: 1.6 },
  { top: "15%", left: "55%", s: 2, delay: 1.4 },
];

export function AmbientEffects() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* ── Large soft glow blobs ── */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={`blob-${i}`}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: [0, 0.06, 0.03, 0.06],
            scale: [0.6, 1, 0.85, 1],
          }}
          transition={{
            delay: p.delay,
            duration: p.dur,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
          className="absolute rounded-full"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background:
              p.color === "primary"
                ? "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)"
                : "radial-gradient(circle, hsl(var(--gold) / 0.12) 0%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />
      ))}

      {/* ── Tiny sparkle dots ── */}
      {DOTS.map((d, i) => (
        <motion.div
          key={`dot-${i}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.4, 0.1, 0.4],
            scale: [0, 1, 0.6, 1],
          }}
          transition={{
            delay: d.delay,
            duration: 4 + i * 0.5,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
          className="absolute rounded-full bg-primary"
          style={{
            top: d.top,
            left: d.left,
            width: d.s,
            height: d.s,
          }}
        />
      ))}

      {/* ── Primary accent glow — top-left ── */}
      <div
        className="absolute"
        style={{
          top: "-15%",
          left: "-25%",
          width: "70%",
          height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.07) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Secondary accent glow — bottom-right ── */}
      <div
        className="absolute"
        style={{
          bottom: "-10%",
          right: "-20%",
          width: "75%",
          height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.05) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Gold warm glow — center ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 2 }}
        className="absolute"
        style={{
          top: "35%",
          left: "20%",
          width: "60%",
          height: "30%",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(var(--gold) / 0.03) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* ── Horizontal line accents ── */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.8, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute"
        style={{
          top: "48%",
          left: "5%",
          right: "5%",
          height: 1,
          background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.06) 50%, transparent)",
          transformOrigin: "left",
        }}
      />

      {/* ── Ground shadow ── */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          height: "25%",
          background: "linear-gradient(to bottom, transparent, hsl(var(--foreground) / 0.03))",
        }}
      />
      <div
        className="absolute left-[6%] right-[6%] bottom-0"
        style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.1) 50%, transparent)",
        }}
      />

      {/* ── Vignette overlay ── */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, hsl(var(--background) / 0.4) 100%)",
        }}
      />
    </div>
  );
}
