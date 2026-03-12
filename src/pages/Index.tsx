import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { OrbitSystem } from "@/components/landing/OrbitSystem";
import { SlimPillButton } from "@/components/landing/SlimPillButton";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 10% 0%, hsl(0 78% 45% / 0.18) 0%, transparent 45%),
          radial-gradient(ellipse at 90% 0%, hsl(0 0% 12% / 0.15) 0%, transparent 45%),
          radial-gradient(ellipse at 50% 40%, hsl(0 0% 94%) 0%, transparent 60%),
          radial-gradient(ellipse at 30% 90%, hsl(0 78% 45% / 0.10) 0%, transparent 45%),
          radial-gradient(ellipse at 80% 85%, hsl(0 0% 15% / 0.08) 0%, transparent 45%),
          hsl(0 0% 95%)
        `,
      }}
    >
      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Orbital system */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0"
          >
            <OrbitSystem />
          </motion.div>

          {/* Spacer */}
          <div className="flex-1 min-h-2" />

          {/* Text + Button */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <p
              className="text-[12px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: "hsl(0 0% 45%)" }}
            >
              DUB Agenda
            </p>

            <h1
              className="text-[44px] leading-[1.05] tracking-tight"
              style={{ color: "hsl(0 0% 8%)" }}
            >
              <span className="font-extralight">Seu </span>
              <span className="font-normal italic" style={{ fontFamily: "'Nunito', sans-serif" }}>
                Estilo
              </span>
            </h1>
            <h1 className="text-[44px] leading-[1.05] tracking-tight">
              <span
                className="font-semibold"
                style={{
                  background: "linear-gradient(90deg, hsl(0 78% 45%) 0%, hsl(0 0% 10%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Começa Aqui
              </span>
            </h1>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full mt-6 mb-6 flex justify-center"
          >
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
