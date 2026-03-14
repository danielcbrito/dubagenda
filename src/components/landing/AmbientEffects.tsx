import { motion } from "framer-motion";

/**
 * SVG inline icons de barbearia — preto e branco, bem transparentes.
 * Cada um retorna um <path> para ser usado dentro de um <svg>.
 */
const BARBER_ICONS = [
  // Scissors
  (
    <path
      d="M6.5 6.5a3.5 3.5 0 1 0-1.59 2.93L12 12l-7.09 2.57A3.5 3.5 0 1 0 6.5 17.5c0-.74-.23-1.43-.63-2L12 12l6.13 3.5a3.5 3.5 0 1 0 .37-1.12L12 12l6.5-2.38a3.5 3.5 0 1 0-.37-1.12L12 12 5.87 8.5c.4-.57.63-1.26.63-2z"
      strokeWidth="1.5"
      fill="none"
    />
  ),
  // Comb
  (
    <path
      d="M3 5h18v2H3zM5 7v12M8 7v12M11 7v12M14 7v12M17 7v12M19 7v12M3 7h18"
      strokeWidth="1.2"
      fill="none"
    />
  ),
  // Razor
  (
    <path
      d="M4 20L20 4M4 20l2-6 14-14M6 14l2-2M10 10l2-2"
      strokeWidth="1.3"
      fill="none"
    />
  ),
  // Hair dryer
  (
    <path
      d="M8 16h4a4 4 0 0 0 0-8H8v8zM8 8H4v8h4M16 12h4"
      strokeWidth="1.3"
      fill="none"
    />
  ),
  // Mirror
  (
    <path
      d="M12 2a6 6 0 0 1 0 12 6 6 0 0 1 0-12zM12 14v8M8 22h8"
      strokeWidth="1.3"
      fill="none"
    />
  ),
  // Spray bottle
  (
    <path
      d="M10 6V4h4v2M9 6h6l1 4H8l1-4zM8 10h8v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10z"
      strokeWidth="1.2"
      fill="none"
    />
  ),
  // Star
  (
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"
      strokeWidth="1.2"
      fill="none"
    />
  ),
  // Crown
  (
    <path
      d="M2 20h20L19 8l-5 6-2-8-2 8-5-6-3 12z"
      strokeWidth="1.2"
      fill="none"
    />
  ),
];

// Positions for background icons — scattered across the middle zone
const ICON_PLACEMENTS = [
  { top: "18%", left: "8%", size: 22, rot: -15, delay: 0.4 },
  { top: "12%", left: "78%", size: 18, rot: 20, delay: 0.7 },
  { top: "35%", left: "88%", size: 20, rot: -30, delay: 1.0 },
  { top: "52%", left: "6%", size: 16, rot: 10, delay: 0.6 },
  { top: "60%", left: "75%", size: 24, rot: -20, delay: 1.3 },
  { top: "42%", left: "50%", size: 14, rot: 45, delay: 0.9 },
  { top: "28%", left: "35%", size: 16, rot: -10, delay: 1.1 },
  { top: "72%", left: "30%", size: 18, rot: 25, delay: 0.5 },
  { top: "78%", left: "65%", size: 14, rot: -35, delay: 1.5 },
  { top: "22%", left: "60%", size: 20, rot: 15, delay: 0.8 },
];

/** Floating bokeh particles */
const PARTICLES = [
  { top: "6%", left: "72%", size: 80, delay: 0.4, dur: 8, color: "primary" },
  { top: "38%", left: "3%", size: 120, delay: 0.8, dur: 10, color: "primary" },
  { top: "65%", left: "78%", size: 60, delay: 1.2, dur: 7, color: "primary" },
  { top: "18%", left: "88%", size: 40, delay: 1.5, dur: 9, color: "primary" },
  { top: "80%", left: "12%", size: 50, delay: 0.6, dur: 11, color: "primary" },
  { top: "50%", left: "50%", size: 140, delay: 1.0, dur: 12, color: "primary" },
];

export function AmbientEffects() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* ── Barber icons scattered in background ── */}
      {ICON_PLACEMENTS.map((p, i) => (
        <motion.div
          key={`icon-${i}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.04, scale: 1 }}
          transition={{ delay: p.delay, duration: 1, ease: "easeOut" }}
          className="absolute"
          style={{
            top: p.top,
            left: p.left,
            transform: `rotate(${p.rot}deg)`,
          }}
        >
          <svg
            width={p.size}
            height={p.size}
            viewBox="0 0 24 24"
            stroke="hsl(var(--foreground))"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {BARBER_ICONS[i % BARBER_ICONS.length]}
          </svg>
        </motion.div>
      ))}

      {/* ── Scenery: rolling hills / morro de desenho ── */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 480 120"
        preserveAspectRatio="none"
        style={{ height: "18%" }}
      >
        {/* Hill layer 1 — back */}
        <motion.path
          d="M0 120 Q60 40 140 70 Q220 20 300 60 Q380 30 480 55 L480 120 Z"
          fill="hsl(var(--foreground))"
          fillOpacity="0.025"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
        />
        {/* Hill layer 2 — mid */}
        <motion.path
          d="M0 120 Q80 65 180 80 Q260 50 360 75 Q420 55 480 70 L480 120 Z"
          fill="hsl(var(--foreground))"
          fillOpacity="0.035"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
        />
        {/* Hill layer 3 — front */}
        <motion.path
          d="M0 120 Q100 85 200 95 Q300 75 400 90 Q450 80 480 88 L480 120 Z"
          fill="hsl(var(--foreground))"
          fillOpacity="0.045"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1 }}
        />
        {/* Ground line */}
        <line
          x1="20" y1="118" x2="460" y2="118"
          stroke="hsl(var(--foreground))"
          strokeOpacity="0.08"
          strokeWidth="0.8"
        />
      </svg>

      {/* ── Soft glow blobs ── */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={`blob-${i}`}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: [0, 0.05, 0.025, 0.05],
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
            background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)",
            filter: "blur(30px)",
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
          background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Accent glow — bottom-right ── */}
      <div
        className="absolute"
        style={{
          bottom: "-10%",
          right: "-20%",
          width: "75%",
          height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.04) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Horizontal line accent ── */}
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
          background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.05) 50%, transparent)",
          transformOrigin: "left",
        }}
      />

      {/* ── Vignette ── */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, hsl(var(--background) / 0.4) 100%)",
        }}
      />
    </div>
  );
}
