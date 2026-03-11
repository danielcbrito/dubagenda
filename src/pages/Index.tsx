import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import orbitCalendar from "@/assets/orbit-calendar.png";
import orbitGlobe from "@/assets/orbit-globe.png";
import orbitParty from "@/assets/orbit-party.png";
import orbitPin from "@/assets/orbit-pin.png";

import avatarBeanie from "@/assets/avatar-beanie.png";
import avatarGlassesGirl from "@/assets/avatar-glasses-girl.png";
import avatarElderly from "@/assets/avatar-elderly.png";
import avatarHijab from "@/assets/avatar-hijab.png";
import avatarBraids from "@/assets/avatar-braids.png";

const FONT = "'Plus Jakarta Sans', sans-serif";

/* ── Keyframes ── */
const orbitCSS = `
@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse-glow { 
  0%, 100% { transform: scale(1); opacity: 1; } 
  50% { transform: scale(1.08); opacity: 0.88; } 
}
`;

interface OrbitItem {
  type: "avatar" | "icon";
  src: string;
  angle: number;
  ring: 1 | 2 | 3;
  size: number;
  bg?: string;
}

const RINGS = {
  1: { radius: 80, duration: 30 },
  2: { radius: 140, duration: 25 },
  3: { radius: 195, duration: 35 },
};

const items: OrbitItem[] = [
  { type: "avatar", src: avatarBeanie,      angle: 30,  ring: 3, size: 54, bg: "#F4A261" },
  { type: "icon",   src: orbitPin,          angle: 90,  ring: 3, size: 52 },
  { type: "avatar", src: avatarGlassesGirl, angle: 150, ring: 3, size: 50, bg: "#E9C46A" },
  { type: "avatar", src: avatarBraids,      angle: 230, ring: 3, size: 54, bg: "#C77DFF" },
  { type: "icon",   src: orbitCalendar,     angle: 310, ring: 3, size: 52 },
  { type: "avatar", src: avatarElderly,     angle: 60,  ring: 2, size: 46, bg: "#7EC8A0" },
  { type: "icon",   src: orbitParty,        angle: 170, ring: 2, size: 44 },
  { type: "avatar", src: avatarHijab,       angle: 280, ring: 2, size: 50, bg: "#89CFF0" },
  { type: "icon",   src: orbitGlobe,        angle: 120, ring: 1, size: 40 },
];

const OrbitSystem = () => {
  const renderRing = (ringNum: 1 | 2 | 3) => {
    const { radius, duration } = RINGS[ringNum];
    const ringItems = items.filter(i => i.ring === ringNum);
    const direction = ringNum === 2 ? "reverse" : "normal";

    return (
      <div
        key={ringNum}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: radius * 2,
          height: radius * 2,
          marginLeft: -radius,
          marginTop: -radius,
          animation: `spin-slow ${duration}s linear infinite`,
          animationDirection: direction,
        }}
      >
        {ringItems.map((item, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 0,
              height: 0,
              transform: `rotate(${item.angle}deg) translateX(${radius}px)`,
            }}
          >
            <div
              style={{
                animation: `spin-slow ${duration}s linear infinite`,
                animationDirection: direction === "reverse" ? "normal" : "reverse",
                width: item.size,
                height: item.size,
                marginLeft: -item.size / 2,
                marginTop: -item.size / 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.type === "avatar" ? (
                <div
                  style={{
                    width: item.size,
                    height: item.size,
                    borderRadius: "50%",
                    background: item.bg,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                  }}
                >
                  <img src={item.src} alt="" style={{ width: "80%", height: "80%", objectFit: "cover", borderRadius: "50%" }} />
                </div>
              ) : (
                <img
                  src={item.src}
                  alt=""
                  style={{ width: item.size, height: item.size, objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: RINGS[3].radius * 2 + 70, height: RINGS[3].radius * 2 + 70, margin: "0 auto" }}>
      {/* Orbit rings */}
      {([1, 2, 3] as const).map(ringNum => {
        const r = RINGS[ringNum].radius;
        return (
          <div
            key={`ring-${ringNum}`}
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: r * 2, height: r * 2,
              marginLeft: -r, marginTop: -r,
              borderRadius: "50%",
              border: `1.2px solid rgba(255,255,255,${ringNum === 2 ? 0.55 : 0.3})`,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Center glow — red/warm */}
      <div
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 150, height: 150,
          marginLeft: -75, marginTop: -75,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,40,40,0.15) 0%, rgba(255,120,80,0.08) 50%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* Center sparkle — brand red gradient */}
      <div
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 80, height: 80,
          marginLeft: -40, marginTop: -40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          animation: "pulse-glow 3s ease-in-out infinite",
        }}
      >
        <svg width="70" height="70" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="sparkleGrad" x1="30" y1="0" x2="70" y2="100">
              <stop offset="0%" stopColor="#E53935" />
              <stop offset="50%" stopColor="#FF6B35" />
              <stop offset="100%" stopColor="#FBBF24" />
            </linearGradient>
          </defs>
          <path
            d="M50 2 L55 40 Q56 46 62 47 L98 50 L62 53 Q56 54 55 60 L50 98 L45 60 Q44 54 38 53 L2 50 L38 47 Q44 46 45 40 Z"
            fill="url(#sparkleGrad)"
          />
        </svg>
      </div>

      {([1, 2, 3] as const).map(ringNum => renderRing(ringNum))}
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();

  return (
    <>
      <style>{orbitCSS}</style>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 10% 0%, rgba(200,50,50,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 5%, rgba(255,180,160,0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 95%, rgba(240,230,245,0.25) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(255,250,245,0.5) 0%, transparent 70%),
            linear-gradient(135deg, #ECEEF3 0%, #F0EAE5 50%, #F4E8E3 100%)
          `,
        }}
      >
        <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full px-6 pt-[calc(env(safe-area-inset-top,0px)+2rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">

          {/* Orbital illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 mt-4"
          >
            <OrbitSystem />
          </motion.div>

          {/* Text section */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mt-6"
          >
            {/* App name — sem estrela */}
            <p
              style={{
                fontFamily: FONT,
                fontWeight: 300,
                fontSize: 14,
                letterSpacing: "0.12em",
                color: "#999",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              DUB Agenda
            </p>

            {/* Headline */}
            <h1
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 40,
                color: "#111",
                lineHeight: 1.08,
                margin: 0,
              }}
            >
              Seu Estilo
            </h1>

            {/* Sub-headline — brand red gradient */}
            <h2
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.08,
                margin: 0,
                background: "linear-gradient(90deg, #C62828, #E53935, #FF6B35)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Começa Aqui
            </h2>
          </motion.div>

          {/* Spacer */}
          <div className="flex-1 min-h-6" />

          {/* CTA Button — slim */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex justify-center mb-4"
          >
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="active:scale-[0.97] transition-transform duration-150"
              style={{
                width: "88%",
                height: 48,
                borderRadius: 100,
                background: "#111",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
              }}
            >
              <span
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 15,
                  color: "#fff",
                  letterSpacing: "0.02em",
                }}
              >
                Encontrar Barbearias
              </span>
            </button>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Index;
