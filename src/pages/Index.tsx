import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ArrowRight } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";

// Orbital icon data — positioned by angle around center
const orbitIcons = [
  // Outer ring icons
  { emoji: "📍", angle: 0, ring: "outer", bg: "linear-gradient(135deg, #A855F7, #EC4899)", size: 44 },
  { emoji: "👩‍🦰", angle: 45, ring: "outer", bg: "#FBBF24", size: 40 },
  { emoji: "🎉", angle: 90, ring: "outer", bg: "transparent", size: 38 },
  { emoji: "👩🏿‍🦱", angle: 145, ring: "outer", bg: "#C084FC", size: 40 },
  { emoji: "🌍", angle: 200, ring: "outer", bg: "transparent", size: 42 },
  { emoji: "👩‍🦳", angle: 250, ring: "outer", bg: "#93C5FD", size: 40 },
  { emoji: "📅", angle: 310, ring: "outer", bg: "transparent", size: 42 },
  { emoji: "👷", angle: 340, ring: "outer", bg: "#FB923C", size: 40 },
  // Inner ring
  { emoji: "🧓", angle: 30, ring: "inner", bg: "#86EFAC", size: 36 },
];

const OrbitSystem = () => {
  const centerX = 0;
  const centerY = 0;
  const outerR = 148;
  const innerR = 100;

  return (
    <div className="relative w-[320px] h-[320px] mx-auto">
      {/* Orbit rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute"
          style={{ width: outerR * 2, height: outerR * 2 }}
        >
          <div className="w-full h-full rounded-full border border-dashed" style={{ borderColor: "rgba(150,150,150,0.25)" }} />
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
          className="absolute"
          style={{ width: innerR * 2, height: innerR * 2 }}
        >
          <div className="w-full h-full rounded-full border border-dashed" style={{ borderColor: "rgba(150,150,150,0.2)" }} />
        </motion.div>
      </div>

      {/* Center sparkle */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-lg"
          style={{ background: "white" }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L13.5 9.5L20 12L13.5 14.5L12 22L10.5 14.5L4 12L10.5 9.5L12 2Z"
              fill="url(#sparkleGrad)"
            />
            <defs>
              <linearGradient id="sparkleGrad" x1="4" y1="2" x2="20" y2="22">
                <stop stopColor="#FF6B35" />
                <stop offset="1" stopColor="#FF9B6B" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      </div>

      {/* Orbiting icons */}
      {orbitIcons.map((icon, i) => {
        const r = icon.ring === "outer" ? outerR : innerR;
        const rad = (icon.angle * Math.PI) / 180;
        const x = centerX + r * Math.sin(rad);
        const y = centerY - r * Math.cos(rad);

        return (
          <motion.div
            key={i}
            className="absolute z-20"
            style={{
              left: `calc(50% + ${x}px - ${icon.size / 2}px)`,
              top: `calc(50% + ${y}px - ${icon.size / 2}px)`,
              width: icon.size,
              height: icon.size,
            }}
            animate={{ y: [0, -4, 0, 4, 0] }}
            transition={{
              duration: 2.5 + i * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.15,
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center shadow-md"
              style={{
                background: icon.bg || "white",
                fontSize: icon.size * 0.55,
              }}
            >
              {icon.emoji}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 20% 10%, #C8E6F5 0%, transparent 50%),
          radial-gradient(ellipse at 80% 5%, #F5C6C6 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, #FAF0EA 0%, transparent 60%),
          radial-gradient(ellipse at 50% 90%, #F0E8F5 0%, transparent 50%),
          #FAF0EA
        `,
      }}
    >
      {/* Theme color override for status bar */}
      <meta name="theme-color" content="#E8DCD5" />

      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        {/* Floating partial icons at edges */}
        <div className="absolute left-[-18px] top-[38%] text-3xl opacity-60 rotate-[-15deg]">🎟️</div>
        <div className="absolute right-[-14px] bottom-[32%] text-2xl opacity-50 rotate-[20deg]">🎫</div>

        {/* Spacer */}
        <div className="flex-shrink-0 h-[8vh]" />

        {/* Orbital system */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <OrbitSystem />
        </motion.div>

        {/* Brand text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mt-6 mb-2"
        >
          <p className="text-[15px] font-medium tracking-[0.12em] mb-2" style={{ color: "#999" }}>
            DUB ✦ Agenda
          </p>
          <h1
            className="text-[36px] font-extrabold leading-[1.1] tracking-tight"
            style={{ color: "#1A1A1A", fontFamily: "'Inter', sans-serif" }}
          >
            Seu Estilo
          </h1>
          <h1 className="text-[36px] font-extrabold leading-[1.1] tracking-tight">
            <span
              style={{
                background: "linear-gradient(90deg, #4A90D9 0%, #FF6B35 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Começa Aqui
            </span>
          </h1>
        </motion.div>

        {/* Spacer push CTAs down */}
        <div className="flex-1 min-h-4" />

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full space-y-3 mb-4"
        >
          {/* Primary — Exclusivo DUB */}
          <button
            onClick={() => navigate("/auth")}
            className="group relative w-full overflow-hidden rounded-[50px] active:scale-[0.97] transition-all duration-200"
            style={{ background: "#1C1C1E", height: 56 }}
          >
            <div className="flex items-center gap-3.5 px-5 h-full">
              <img
                src={logoDub}
                alt="DUB"
                className="w-9 h-9 object-contain flex-shrink-0 drop-shadow-sm"
              />
              <div className="flex-1 text-left">
                <span className="block text-[15px] font-bold tracking-tight" style={{ color: "#fff" }}>
                  Seja Cliente Exclusivo DUB
                </span>
                <span className="block text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Acesse e agende nas unidades DUB
                </span>
              </div>
              <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }} />
            </div>
          </button>

          {/* Secondary — Encontrar Barbearias */}
          <button
            onClick={() => navigate("/escolher-barbearia")}
            className="group w-full overflow-hidden rounded-[50px] active:scale-[0.97] transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(0,0,0,0.08)",
              height: 56,
            }}
          >
            <div className="flex items-center gap-3.5 px-5 h-full">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,0,0,0.05)" }}
              >
                <MapPin className="w-[18px] h-[18px]" strokeWidth={2} style={{ color: "#444" }} />
              </div>
              <div className="flex-1 text-left">
                <span className="block text-[15px] font-semibold tracking-tight" style={{ color: "#1A1A1A" }}>
                  Encontrar Barbearias
                </span>
                <span className="block text-[11px] mt-0.5" style={{ color: "rgba(0,0,0,0.4)" }}>
                  As melhores perto de você
                </span>
              </div>
              <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(0,0,0,0.2)" }} />
            </div>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="flex items-center justify-center gap-1.5 pb-1"
        >
          <span className="text-[9px] tracking-wider uppercase" style={{ color: "rgba(0,0,0,0.2)" }}>
            © {new Date().getFullYear()} DUB Agenda
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
