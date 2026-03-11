import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import orbitCalendar from "@/assets/orbit-calendar.png";
import orbitClipper from "@/assets/orbit-clipper.png";
import orbitScissors from "@/assets/orbit-scissors.png";
import orbitBarberPole from "@/assets/orbit-barberpole.png";
import orbitTicket from "@/assets/orbit-ticket.png";

import avatarBeanie from "@/assets/avatar-beanie.png";
import avatarGlassesGirl from "@/assets/avatar-glasses-girl.png";
import avatarElderly from "@/assets/avatar-elderly.png";
import avatarHijab from "@/assets/avatar-hijab.png";
import avatarBraids from "@/assets/avatar-braids.png";

const FONT = "'Plus Jakarta Sans', sans-serif";
const OUTER_R = 170;
const INNER_R = 110;
const ORBIT_DURATION = 25; // seconds

interface OrbitIcon {
  type: "avatar" | "icon";
  src: string;
  angle: number;        // starting angle in degrees (0 = top/12 o'clock)
  ring: "outer" | "inner";
  size: number;
  bg?: string;           // avatar circle background
}

const icons: OrbitIcon[] = [
  // OUTER RING
  { type: "icon",   src: orbitScissors,     angle: 0,   ring: "outer", size: 36 },
  { type: "avatar", src: avatarBeanie,      angle: 60,  ring: "outer", size: 52, bg: "#F4A261" },
  { type: "avatar", src: avatarGlassesGirl, angle: 120, ring: "outer", size: 52, bg: "#E9C46A" },
  { type: "avatar", src: avatarBraids,      angle: 180, ring: "outer", size: 52, bg: "#9B5DE5" },
  { type: "avatar", src: avatarHijab,       angle: 240, ring: "outer", size: 52, bg: "#48CAE4" },
  { type: "icon",   src: orbitCalendar,     angle: 300, ring: "outer", size: 40 },
  // INNER RING
  { type: "avatar", src: avatarElderly,     angle: 30,  ring: "inner", size: 44, bg: "#52B788" },
  { type: "icon",   src: orbitBarberPole,   angle: 150, ring: "inner", size: 32 },
  { type: "icon",   src: orbitTicket,       angle: 210, ring: "inner", size: 28 },
  { type: "icon",   src: orbitClipper,      angle: 270, ring: "inner", size: 34 },
];

/* ── Styles injected via <style> for orbit keyframes ── */
const orbitCSS = `
@keyframes orbitOuter { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes orbitInner { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes counterOuter { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
@keyframes counterInner { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
@keyframes pulse-glow { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.06); opacity:0.92; } }
`;

const OrbitSystem = () => {
  const outerIcons = icons.filter(i => i.ring === "outer");
  const innerIcons = icons.filter(i => i.ring === "inner");

  const renderIcon = (icon: OrbitIcon, idx: number, ring: "outer" | "inner") => {
    const r = ring === "outer" ? OUTER_R : INNER_R;
    const dur = ring === "outer" ? ORBIT_DURATION : ORBIT_DURATION * 0.8;
    const counterAnim = ring === "outer" ? "counterOuter" : "counterInner";

    return (
      <div
        key={`${ring}-${idx}`}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 0,
          height: 0,
          transform: `rotate(${icon.angle}deg) translateX(${r}px)`,
          // no animation on wrapper — the parent ring rotates
        }}
      >
        {/* Counter-rotate so icon stays upright */}
        <div
          style={{
            animation: `${counterAnim} ${dur}s linear infinite`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -icon.size / 2,
            marginTop: -icon.size / 2,
            width: icon.size,
            height: icon.size,
          }}
        >
          {icon.type === "avatar" ? (
            <div
              style={{
                width: icon.size,
                height: icon.size,
                borderRadius: "50%",
                background: icon.bg,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              }}
            >
              <img
                src={icon.src}
                alt=""
                style={{ width: "82%", height: "82%", objectFit: "cover", borderRadius: "50%" }}
              />
            </div>
          ) : (
            <img
              src={icon.src}
              alt=""
              style={{
                width: icon.size,
                height: icon.size,
                objectFit: "contain",
                filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.12))",
              }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: OUTER_R * 2 + 60, height: OUTER_R * 2 + 60, margin: "0 auto" }}>
      {/* Dashed orbit rings */}
      <div
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: OUTER_R * 2, height: OUTER_R * 2,
          marginLeft: -OUTER_R, marginTop: -OUTER_R,
          borderRadius: "50%",
          border: "1.5px dashed rgba(0,0,0,0.10)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: INNER_R * 2, height: INNER_R * 2,
          marginLeft: -INNER_R, marginTop: -INNER_R,
          borderRadius: "50%",
          border: "1.5px dashed rgba(0,0,0,0.08)",
          pointerEvents: "none",
        }}
      />

      {/* Center glow */}
      <div
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 130, height: 130,
          marginLeft: -65, marginTop: -65,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,150,50,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Center white circle + sparkle */}
      <div
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 100, height: 100,
          marginLeft: -50, marginTop: -50,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          animation: "pulse-glow 3s ease-in-out infinite",
        }}
      >
        <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="starGrad" x1="20" y1="0" x2="80" y2="100">
              <stop offset="0%" stopColor="#FFD166" />
              <stop offset="100%" stopColor="#EF6C00" />
            </linearGradient>
          </defs>
          <path
            d="M50 5 L56 38 Q57 44 62 45 L95 50 L62 55 Q57 56 56 62 L50 95 L44 62 Q43 56 38 55 L5 50 L38 45 Q43 44 44 38 Z"
            fill="url(#starGrad)"
          />
        </svg>
      </div>

      {/* Outer ring — rotating container */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, width: "100%", height: "100%",
          animation: `orbitOuter ${ORBIT_DURATION}s linear infinite`,
        }}
      >
        {outerIcons.map((icon, i) => renderIcon(icon, i, "outer"))}
      </div>

      {/* Inner ring — rotating container (slightly faster, reverse feel) */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, width: "100%", height: "100%",
          animation: `orbitInner ${ORBIT_DURATION * 0.8}s linear infinite`,
        }}
      >
        {innerIcons.map((icon, i) => renderIcon(icon, i, "inner"))}
      </div>
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
            radial-gradient(ellipse at 15% 5%, #B8D8F0 0%, transparent 55%),
            radial-gradient(ellipse at 88% 5%, #F5C5C5 0%, transparent 55%),
            radial-gradient(ellipse at 50% 92%, #F0E8F5 0%, transparent 55%),
            #FAF5F0
          `,
        }}
      >
        <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full px-6 pt-[calc(env(safe-area-inset-top,0px)+2rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">

          {/* Orbital system — ~55% of viewport */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0"
          >
            <OrbitSystem />
          </motion.div>

          {/* Text section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mt-4"
          >
            {/* App name */}
            <p style={{ fontFamily: FONT, fontWeight: 300, fontSize: 13, letterSpacing: "0.15em", color: "#AAA", marginBottom: 10 }}>
              DUB Agenda
            </p>

            {/* Headline line 1 */}
            <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 42, color: "#111", lineHeight: 1.05, margin: 0 }}>
              Seu Estilo
            </h1>

            {/* Headline line 2 — blue + orange on same line */}
            <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 42, lineHeight: 1.05, margin: 0 }}>
              <span style={{ color: "#5B9CF6" }}>Começa </span>
              <span style={{ color: "#FF6B35" }}>Aqui</span>
            </h1>
          </motion.div>

          {/* Spacer */}
          <div className="flex-1 min-h-4" />

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex justify-center mb-4"
          >
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="active:scale-[0.97] transition-transform duration-150"
              style={{
                width: "calc(100% - 0px)",
                height: 58,
                borderRadius: 100,
                background: "#111111",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}
            >
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 17, color: "#fff" }}>
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
