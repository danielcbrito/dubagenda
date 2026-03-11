import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// 3D orbit icons
import orbitPin from "@/assets/orbit-pin.png";
import orbitCalendar from "@/assets/orbit-calendar.png";
import orbitParty from "@/assets/orbit-party.png";
import orbitGlobe from "@/assets/orbit-globe.png";
import orbitTicket from "@/assets/orbit-ticket.png";
import orbitSparkle from "@/assets/orbit-sparkle.png";

// Avatars
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
  { src: orbitPin, angle: 0, ring: "outer", size: 48, bobDelay: 0 },
  { src: avatarGlassesGirl, angle: 50, ring: "outer", size: 42, isAvatar: true, avatarBg: "#FBBF24", bobDelay: 0.3 },
  { src: orbitParty, angle: 100, ring: "outer", size: 44, bobDelay: 0.6 },
  { src: avatarBraids, angle: 150, ring: "outer", size: 44, isAvatar: true, avatarBg: "#C084FC", bobDelay: 0.9 },
  { src: orbitGlobe, angle: 205, ring: "outer", size: 46, bobDelay: 1.2 },
  { src: avatarHijab, angle: 250, ring: "outer", size: 42, isAvatar: true, avatarBg: "#93C5FD", bobDelay: 1.5 },
  { src: orbitCalendar, angle: 295, ring: "outer", size: 44, bobDelay: 1.8 },
  { src: avatarBeanie, angle: 330, ring: "outer", size: 40, isAvatar: true, avatarBg: "#FB923C", bobDelay: 2.1 },
  { src: avatarElderly, angle: 25, ring: "inner", size: 36, isAvatar: true, avatarBg: "#86EFAC", bobDelay: 0.4 },
];

const OUTER_R = 152;
const INNER_R = 95;

const OrbitSystem = () => (
  <div className="relative w-[340px] h-[340px] mx-auto">
    {/* Orbit rings */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="absolute rounded-full"
        style={{ width: OUTER_R * 2, height: OUTER_R * 2, border: "1.5px solid rgba(180,180,180,0.25)" }}
      />
      <div
        className="absolute rounded-full"
        style={{ width: INNER_R * 2, height: INNER_R * 2, border: "1.5px solid rgba(180,180,180,0.2)" }}
      />
    </div>

    {/* Center — sparkle (the "star") larger, prominent */}
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src={orbitSparkle} alt="" className="w-[72px] h-[72px] object-contain drop-shadow-lg" />
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
        {/* Floating ticket — left edge */}
        <img
          src={orbitTicket}
          alt=""
          className="absolute left-[-22px] top-[42%] w-[56px] opacity-60 -rotate-[15deg] pointer-events-none"
        />

        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          {/* Top — App name */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center text-[13px] font-medium tracking-[0.1em] mb-4"
            style={{ color: "#999", fontFamily: "'Nunito', 'Inter', sans-serif" }}
          >
            DUB Agenda
          </motion.p>

          {/* Orbital system */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0"
          >
            <OrbitSystem />
          </motion.div>

          {/* Text section */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mt-5 mb-2"
          >
            <p
              className="text-[15px] font-medium tracking-[0.12em] mb-3"
              style={{ color: "#999", fontFamily: "'Nunito', 'Inter', sans-serif" }}
            >
              Agenda
            </p>

            <h1
              className="text-[36px] font-light leading-[1.08] tracking-tight"
              style={{ color: "#1A1A1A", fontFamily: "'Nunito', 'Inter', sans-serif" }}
            >
              Seu Estilo
            </h1>
            <h1
              className="text-[36px] font-light leading-[1.08] tracking-tight"
              style={{ fontFamily: "'Nunito', 'Inter', sans-serif" }}
            >
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

          {/* Single CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full mb-8"
          >
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="w-full active:scale-[0.97] transition-transform duration-150"
              style={{ height: 56, borderRadius: 50, background: "#1C1C1E", border: "none", cursor: "pointer" }}
            >
              <span
                className="text-[17px] font-bold tracking-tight"
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
