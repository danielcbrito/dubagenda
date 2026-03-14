import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SlimPillButton } from "@/components/landing/SlimPillButton";
import { OrbitSystem } from "@/components/landing/OrbitSystem";
import logoDub from "@/assets/logo-dub.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 120% 90% at 50% 40%, hsl(220 50% 96%) 0%, hsl(20 40% 94%) 60%, hsl(0 30% 93%) 100%)",
      }}
    >
      {/* Noise texture — barely visible, adds tactile quality */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">

          {/* ─── Top: Brand Mark ─── */}
          <motion.div
            className="flex-shrink-0 flex items-center justify-center gap-2 mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <img
              src={logoDub}
              alt="DUB"
              className="w-6 h-6 object-contain"
              style={{ filter: "grayscale(0.3)" }}
            />
            <span
              className="text-[13px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "hsl(0 0% 55%)" }}
            >
              DUB Agenda
            </span>
          </motion.div>

          {/* ─── Center: Orbital System ─── */}
          <motion.div
            className="flex-1 min-h-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <OrbitSystem />
          </motion.div>

          {/* ─── Bottom: Persuasive copy + CTA ─── */}
          <motion.div
            className="flex-shrink-0 flex flex-col items-center"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Main heading — emotional hook */}
            <h1 className="text-[28px] leading-[1.15] font-bold text-center tracking-[-0.01em]" style={{ color: "hsl(0 0% 12%)" }}>
              Seu barbeiro ideal,
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, hsl(0 72% 46%) 0%, hsl(25 80% 48%) 60%, hsl(38 85% 50%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                a um toque.
              </span>
            </h1>

            {/* Sub-copy — rational benefit */}
            <p
              className="text-[14px] leading-[1.5] text-center mt-3 max-w-[280px]"
              style={{ color: "hsl(0 0% 48%)" }}
            >
              Agende em segundos, sem ligação.
              <br />
              Escolha o profissional e o horário perfeito.
            </p>

            {/* Social proof micro-line */}
            <motion.div
              className="flex items-center gap-1.5 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              <div className="flex -space-x-1.5">
                {[
                  "hsl(15 70% 65%)",
                  "hsl(40 60% 60%)",
                  "hsl(270 35% 62%)",
                ].map((bg, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border-[1.5px]"
                    style={{
                      background: bg,
                      borderColor: "hsl(220 50% 96%)",
                    }}
                  />
                ))}
              </div>
              <span
                className="text-[11px] font-medium"
                style={{ color: "hsl(0 0% 52%)" }}
              >
                +2.400 agendamentos este mês
              </span>
            </motion.div>

            {/* CTA Button */}
            <div className="w-full mt-5 mb-2">
              <SlimPillButton
                label="Encontrar Barbearias"
                onClick={() => navigate("/escolher-barbearia")}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
