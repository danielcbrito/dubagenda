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
  { src: orbitScissors, angle: 0, ring: "outer", size: 58, bobDelay: 0 },
  { src: avatarGlassesGirl, angle: 55, ring: "outer", size: 48, isAvatar: true, avatarBg: "hsl(0 78% 45%)", bobDelay: 0.3 },
  { src: orbitClipper, angle: 105, ring: "outer", size: 56, bobDelay: 0.6 },
  { src: avatarBraids, angle: 155, ring: "outer", size: 50, isAvatar: true, avatarBg: "hsl(0 0% 20%)", bobDelay: 0.9 },
  { src: orbitBarberPole, angle: 210, ring: "outer", size: 52, bobDelay: 1.2 },
  { src: avatarHijab, angle: 260, ring: "outer", size: 46, isAvatar: true, avatarBg: "hsl(0 50% 60%)", bobDelay: 1.5 },
  { src: orbitCalendar, angle: 310, ring: "outer", size: 54, bobDelay: 1.8 },
  { src: avatarBeanie, angle: 340, ring: "inner", size: 42, isAvatar: true, avatarBg: "hsl(0 78% 50%)", bobDelay: 2.0 },
  { src: avatarElderly, angle: 90, ring: "inner", size: 40, isAvatar: true, avatarBg: "hsl(0 0% 30%)", bobDelay: 0.4 },
  { src: orbitTicket, angle: 200, ring: "inner", size: 38, bobDelay: 1.0 },
];

const OUTER_R = 158;
const INNER_R = 96;

const OrbitSystem = () => (
  <div className="relative w-[370px] h-[370px] mx-auto">
    {/* Rings */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="absolute rounded-full" style={{ width: OUTER_R * 2, height: OUTER_R * 2, border: "1.5px solid hsl(0 0% 64% / 0.2)" }} />
      <div className="absolute rounded-full" style={{ width: INNER_R * 2, height: INNER_R * 2, border: "1.5px solid hsl(0 0% 64% / 0.15)" }} />
    </div>

    {/* Center sparkle */}
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src={orbitSparkle} alt="" className="w-[96px] h-[96px] object-contain drop-shadow-lg" />
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
          animate={{ y: [0, -5, 0, 5, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: item.bobDelay || 0 }}
        >
          {item.isAvatar ? (
            <div
              className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: item.avatarBg, boxShadow: "0 4px 18px rgba(0,0,0,0.12)" }}
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
          radial-gradient(ellipse at 15% 8%, hsl(0 78% 45% / 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 85% 5%, hsl(0 0% 90%) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 45%, hsl(0 0% 97%) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 95%, hsl(0 78% 45% / 0.05) 0%, transparent 50%),
          hsl(0 0% 98%)
        `,
      }}
    >
      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Orbital system */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0"
          >
            <OrbitSystem />
          </motion.div>

          {/* Spacer pushes text+button to bottom */}
          <div className="flex-1 min-h-4" />

          {/* Text + Button block — tightly grouped */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <p
              className="text-[13px] font-medium tracking-[0.2em] uppercase mb-3"
              style={{ color: "hsl(0 0% 55%)" }}
            >
              DUB Agenda
            </p>

            <h1
              className="text-[40px] font-extralight leading-[1.08] tracking-tight"
              style={{ color: "hsl(0 0% 10%)" }}
            >
              Seu Estilo
            </h1>
            <h1
              className="text-[40px] font-extralight leading-[1.08] tracking-tight"
            >
              <span
                style={{
                  background: "linear-gradient(90deg, hsl(0 78% 45%) 20%, hsl(0 0% 15%) 80%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Começa Aqui
              </span>
            </h1>
          </motion.div>

          {/* CTA button — right below title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full mt-8 mb-6"
          >
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="w-full active:scale-[0.97] transition-transform duration-150"
              style={{
                height: 42,
                borderRadius: 50,
                background: "hsl(0 0% 8%)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span
                className="text-[14px] font-semibold tracking-tight"
                style={{ color: "hsl(0 0% 98%)" }}
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
