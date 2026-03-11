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

interface OrbitItem {
  src: string;
  angle: number;
  ring: "outer" | "inner";
  size: number;
  isAvatar?: boolean;
  avatarBg?: string;
  bobDelay?: number;
}

const orbitItems: OrbitItem[] = [
  // Outer ring — barber tools + avatars, varied sizes
  { src: orbitScissors, angle: 0, ring: "outer", size: 52, bobDelay: 0 },
  { src: avatarGlassesGirl, angle: 55, ring: "outer", size: 42, isAvatar: true, avatarBg: "#FBBF24", bobDelay: 0.3 },
  { src: orbitClipper, angle: 105, ring: "outer", size: 50, bobDelay: 0.6 },
  { src: avatarBraids, angle: 155, ring: "outer", size: 44, isAvatar: true, avatarBg: "#C084FC", bobDelay: 0.9 },
  { src: orbitBarberPole, angle: 210, ring: "outer", size: 46, bobDelay: 1.2 },
  { src: avatarHijab, angle: 260, ring: "outer", size: 40, isAvatar: true, avatarBg: "#93C5FD", bobDelay: 1.5 },
  { src: orbitCalendar, angle: 310, ring: "outer", size: 48, bobDelay: 1.8 },
  // Inner ring
  { src: avatarBeanie, angle: 340, ring: "inner", size: 38, isAvatar: true, avatarBg: "#FB923C", bobDelay: 2.0 },
  { src: avatarElderly, angle: 90, ring: "inner", size: 36, isAvatar: true, avatarBg: "#86EFAC", bobDelay: 0.4 },
  { src: orbitTicket, angle: 200, ring: "inner", size: 34, bobDelay: 1.0 },
];

const OUTER_R = 148;
const INNER_R = 90;

const OrbitSystem = () => (
  <div className="relative w-[330px] h-[330px] mx-auto">
    {/* Rings */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="absolute rounded-full" style={{ width: OUTER_R * 2, height: OUTER_R * 2, border: "1.5px solid rgba(180,180,180,0.25)" }} />
      <div className="absolute rounded-full" style={{ width: INNER_R * 2, height: INNER_R * 2, border: "1.5px solid rgba(180,180,180,0.18)" }} />
    </div>

    {/* Center sparkle — the "star" — largest element */}
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src={orbitSparkle} alt="" className="w-[80px] h-[80px] object-contain drop-shadow-lg" />
      </motion.div>
    </div>

    {/* Orbiting items */}
    {orbitItems.map((item, i) => {
      const r = item.ring === "outer" ? OUTER_R : INNER_R;
      const rad = (item.angle * Math.PI) / 180;
      const x = r * Math.sin(rad);
      const y = -r * Math.cos(rad);

      return (
        <motion.div
          key={i}
          className="absolute z-20"
          style={{
            left: `calc(50% + ${x}px - ${item.size / 2}px)`,
            top: `calc(50% + ${y}px - ${item.size / 2}px)`,
            width: item.size,
            height: item.size,
          }}
          animate={{ y: [0, -4, 0, 4, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: item.bobDelay || 0 }}
        >
          {item.isAvatar ? (
            <div
              className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: item.avatarBg, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
            >
              <img src={item.src} alt="" className="w-[85%] h-[85%] object-cover rounded-full" />
            </div>
          ) : (
            <img src={item.src} alt="" className="w-full h-full object-contain drop-shadow-md" />
          )}
        </motion.div>
      );
    })}
  </div>
);

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 15% 8%, #C8E6F5 0%, transparent 50%),
          radial-gradient(ellipse at 85% 5%, #F5C6C6 0%, transparent 50%),
          radial-gradient(ellipse at 50% 45%, #FAF0EA 0%, transparent 55%),
          radial-gradient(ellipse at 50% 95%, #F0E8F5 0%, transparent 50%),
          #FAF0EA
        `,
      }}
    >
      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Orbital system */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0"
          >
            <OrbitSystem />
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mt-6"
          >
            <p
              className="text-[15px] font-normal tracking-[0.15em] mb-3"
              style={{ color: "#999", fontFamily: "'Nunito', 'Inter', sans-serif" }}
            >
              DUB Agenda
            </p>

            <h1
              className="text-[34px] font-light leading-[1.1] tracking-tight"
              style={{ color: "#1A1A1A", fontFamily: "'Nunito', 'Inter', sans-serif" }}
            >
              Seu Estilo
            </h1>
            <h1 className="text-[34px] font-light leading-[1.1] tracking-tight" style={{ fontFamily: "'Nunito', 'Inter', sans-serif" }}>
              <span
                style={{
                  background: "linear-gradient(90deg, #4A90D9 20%, #FF6B35 80%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Começa Aqui
              </span>
            </h1>
          </motion.div>

          {/* Spacer */}
          <div className="flex-1 min-h-6" />

          {/* Slim CTA button */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full mb-6"
          >
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="w-full active:scale-[0.97] transition-transform duration-150"
              style={{ height: 44, borderRadius: 50, background: "#1C1C1E", border: "none", cursor: "pointer" }}
            >
              <span
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: "#FFFFFF", fontFamily: "'Nunito', 'Inter', sans-serif" }}
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
