import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SlimPillButton } from "@/components/landing/SlimPillButton";
import { OrbitSystem } from "@/components/landing/OrbitSystem";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(220 60% 95%) 0%, hsl(15 60% 93%) 100%)",
      }}
    >
      {/* Noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-7 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">

          {/* Orbit system — fills upper area */}
          <motion.div
            className="flex-1 min-h-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <OrbitSystem />
          </motion.div>

          {/* Bottom section — brand + title + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 flex flex-col items-center gap-4 mb-4"
          >
            {/* Brand */}
            <span
              className="text-[15px] font-bold tracking-[0.02em]"
              style={{ color: "hsl(0 0% 63%)" }}
            >
              DUB Agenda
            </span>

            {/* Title */}
            <h1 className="text-[32px] leading-[1.1] font-bold text-center text-foreground">
              Encontre seu Barbeiro
              <br />
              <span
                className="font-bold"
                style={{
                  background: "linear-gradient(90deg, hsl(0 72% 50%) 0%, hsl(25 80% 50%) 50%, hsl(40 90% 55%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Perto de Você
              </span>
            </h1>

            {/* CTA */}
            <div className="w-full mt-2">
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
