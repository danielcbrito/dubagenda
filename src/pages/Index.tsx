import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SlimPillButton } from "@/components/landing/SlimPillButton";
import { OrbitSystem } from "@/components/landing/OrbitSystem";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "hsl(0 0% 97%)" }}
    >
      {/* Soft color washes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 30% 20%, hsl(210 60% 85% / 0.25) 0%, transparent 100%),
            radial-gradient(ellipse 50% 40% at 75% 60%, hsl(330 50% 88% / 0.2) 0%, transparent 100%)
          `,
        }}
      />

      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-7 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">

          {/* Orbit system — fills most of the screen */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center">
            <OrbitSystem />
          </div>

          {/* Bottom section — brand + title + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 flex flex-col items-center gap-5 mb-4"
          >
            {/* Brand label */}
            <div className="flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-primary" />
              <span className="text-[11px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
                DUB Agenda
              </span>
            </div>

            {/* Title */}
            <h1 className="text-[28px] leading-[1.15] tracking-[-0.01em] font-medium text-center text-foreground">
              Encontre seu{" "}
              <span
                className="font-bold italic"
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  background: "linear-gradient(135deg, hsl(0 72% 48%) 0%, hsl(18 55% 38%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Barbeiro Ideal
              </span>
            </h1>

            {/* CTA */}
            <SlimPillButton
              label="Encontrar Barbearias"
              onClick={() => navigate("/escolher-barbearia")}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
