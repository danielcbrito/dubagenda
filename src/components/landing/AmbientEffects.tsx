import { motion } from "framer-motion";

/**
 * Barber icons as SVG paths — used as decorative background elements
 */
const BARBER_ICONS: JSX.Element[] = [
  // Scissors
  <path key="scissors" d="M6.5 6.5a3.5 3.5 0 1 0-1.59 2.93L12 12l-7.09 2.57A3.5 3.5 0 1 0 6.5 17.5c0-.74-.23-1.43-.63-2L12 12l6.13 3.5a3.5 3.5 0 1 0 .37-1.12L12 12l6.5-2.38a3.5 3.5 0 1 0-.37-1.12L12 12 5.87 8.5c.4-.57.63-1.26.63-2z" strokeWidth="1.5" fill="none" />,
  // Comb
  <path key="comb" d="M3 5h18v2H3zM5 7v12M8 7v12M11 7v12M14 7v12M17 7v12M19 7v12M3 7h18" strokeWidth="1.2" fill="none" />,
  // Razor
  <path key="razor" d="M4 20L20 4M4 20l2-6 14-14M6 14l2-2M10 10l2-2" strokeWidth="1.3" fill="none" />,
  // Hair dryer
  <path key="dryer" d="M8 16h4a4 4 0 0 0 0-8H8v8zM8 8H4v8h4M16 12h4" strokeWidth="1.3" fill="none" />,
  // Mirror
  <path key="mirror" d="M12 2a6 6 0 0 1 0 12 6 6 0 0 1 0-12zM12 14v8M8 22h8" strokeWidth="1.3" fill="none" />,
  // Spray bottle
  <path key="spray" d="M10 6V4h4v2M9 6h6l1 4H8l1-4zM8 10h8v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10z" strokeWidth="1.2" fill="none" />,
  // Star
  <path key="star" d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" strokeWidth="1.2" fill="none" />,
  // Crown
  <path key="crown" d="M2 20h20L19 8l-5 6-2-8-2 8-5-6-3 12z" strokeWidth="1.2" fill="none" />,
  // Mustache
  <path key="mustache" d="M2 12c0-3 2-5 5-4s3 4 5 4 2-3 5-4 5 1 5 4c0 2-2 3-5 3s-3-2-5-2-2 2-5 2-5-1-5-3z" strokeWidth="1.2" fill="none" />,
  // Barber pole
  <path key="pole" d="M8 2h8v20H8zM8 2l8 5M8 7l8 5M8 12l8 5M8 17l8 5" strokeWidth="1.1" fill="none" />,
];

// Top zone: denser, more visible, some red. Bottom zone: fades out.
const ICON_PLACEMENTS = [
  // ── Top zone — MORE VISIBLE, red accents ──
  { top: "4%",  left: "6%",  size: 32, rot: -15, delay: 0.3, opacity: 0.18, red: true },
  { top: "3%",  left: "70%", size: 28, rot: 20,  delay: 0.5, opacity: 0.15, red: false },
  { top: "10%", left: "40%", size: 24, rot: -10, delay: 0.7, opacity: 0.14, red: true },
  { top: "8%",  left: "85%", size: 20, rot: 35,  delay: 0.4, opacity: 0.12, red: false },
  { top: "15%", left: "18%", size: 26, rot: 10,  delay: 0.6, opacity: 0.13, red: true },
  { top: "14%", left: "60%", size: 22, rot: -25, delay: 0.8, opacity: 0.12, red: false },
  { top: "20%", left: "82%", size: 30, rot: 15,  delay: 0.9, opacity: 0.10, red: true },
  { top: "22%", left: "4%",  size: 18, rot: -30, delay: 0.5, opacity: 0.10, red: false },

  // ── Mid zone — medium visibility ──
  { top: "30%", left: "50%", size: 20, rot: 25,  delay: 1.0, opacity: 0.07, red: false },
  { top: "35%", left: "10%", size: 22, rot: -20, delay: 1.1, opacity: 0.06, red: false },
  { top: "38%", left: "75%", size: 18, rot: 10,  delay: 1.2, opacity: 0.06, red: true },
  { top: "42%", left: "30%", size: 16, rot: -15, delay: 1.0, opacity: 0.05, red: false },

  // ── Bottom zone — subtle ──
  { top: "55%", left: "85%", size: 16, rot: 20,  delay: 1.3, opacity: 0.04, red: false },
  { top: "60%", left: "15%", size: 14, rot: -10, delay: 1.4, opacity: 0.03, red: false },
  { top: "68%", left: "55%", size: 14, rot: 30,  delay: 1.5, opacity: 0.03, red: false },
];

/** Soft glow blobs */
const GLOWS = [
  { top: "0%",  left: "60%", size: 100, delay: 0.3, dur: 8 },
  { top: "30%", left: "0%",  size: 130, delay: 0.7, dur: 10 },
  { top: "55%", left: "70%", size: 80,  delay: 1.0, dur: 7 },
  { top: "15%", left: "85%", size: 60,  delay: 1.2, dur: 9 },
  { top: "70%", left: "10%", size: 70,  delay: 0.5, dur: 11 },
];

export function AmbientEffects() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>

      {/* ── Red accent gradient at top — draws attention ── */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{
          height: "35%",
          background: "linear-gradient(to bottom, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 50%, transparent 100%)",
        }}
      />

      {/* ── Barber icons scattered — gradient from visible→transparent ── */}
      {ICON_PLACEMENTS.map((p, i) => (
        <motion.div
          key={`icon-${i}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: p.opacity, scale: 1 }}
          transition={{ delay: p.delay, duration: 0.8, ease: "easeOut" }}
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
            stroke={p.red ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {BARBER_ICONS[i % BARBER_ICONS.length]}
          </svg>
        </motion.div>
      ))}

      {/* ── Scenery: rolling hills ── */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 480 120"
        preserveAspectRatio="none"
        style={{ height: "18%" }}
      >
        <motion.path
          d="M0 120 Q60 40 140 70 Q220 20 300 60 Q380 30 480 55 L480 120 Z"
          fill="hsl(var(--foreground))"
          fillOpacity="0.03"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
        />
        <motion.path
          d="M0 120 Q80 65 180 80 Q260 50 360 75 Q420 55 480 70 L480 120 Z"
          fill="hsl(var(--foreground))"
          fillOpacity="0.045"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
        />
        <motion.path
          d="M0 120 Q100 85 200 95 Q300 75 400 90 Q450 80 480 88 L480 120 Z"
          fill="hsl(var(--foreground))"
          fillOpacity="0.06"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1 }}
        />
        <line x1="20" y1="118" x2="460" y2="118" stroke="hsl(var(--foreground))" strokeOpacity="0.1" strokeWidth="0.8" />
      </svg>

      {/* ── Soft red glow blobs ── */}
      {GLOWS.map((p, i) => (
        <motion.div
          key={`glow-${i}`}
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
            background: "radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />
      ))}

      {/* ── Top-left primary glow ── */}
      <div
        className="absolute"
        style={{
          top: "-15%", left: "-25%", width: "70%", height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Horizontal accent line ── */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.8, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute"
        style={{
          top: "48%", left: "5%", right: "5%", height: 1,
          background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.06) 50%, transparent)",
          transformOrigin: "left",
        }}
      />

      {/* ── Vignette ── */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, hsl(var(--background) / 0.3) 100%)",
        }}
      />
    </div>
  );
}
