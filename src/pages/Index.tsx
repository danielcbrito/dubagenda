import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SlimPillButton } from "@/components/landing/SlimPillButton";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: "hsl(0 0% 97%)",
      }}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Soft color washes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 20% 10%, hsl(0 65% 55% / 0.07) 0%, transparent 100%),
            radial-gradient(ellipse 40% 40% at 80% 80%, hsl(30 60% 50% / 0.05) 0%, transparent 100%)
          `,
        }}
      />

      <div className="relative flex-1 flex flex-col max-w-[430px] mx-auto w-full">
        <div className="flex-1 flex flex-col px-7 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">

          {/* Top — brand mark */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-[6px] h-[6px] rounded-full"
                style={{ background: "hsl(0 72% 50%)" }}
              />
              <span
                className="text-[11px] font-medium tracking-[0.3em] uppercase"
                style={{ color: "hsl(0 0% 40%)" }}
              >
                DUB Agenda
              </span>
            </div>
          </motion.div>

          {/* Main — giant editorial typography */}
          <div className="flex-1 flex flex-col justify-center -mt-8">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Decorative thin line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="origin-left mb-6"
              >
                <div className="h-[1px] w-16" style={{ background: "hsl(0 0% 75%)" }} />
              </motion.div>

              <h1
                className="text-[52px] leading-[0.95] tracking-[-0.03em] font-extralight"
                style={{ color: "hsl(0 0% 10%)" }}
              >
                Seu
              </h1>

              <h1
                className="text-[62px] leading-[0.95] tracking-[-0.03em] mt-1"
                style={{ color: "hsl(0 0% 10%)" }}
              >
                <span
                  className="font-semibold italic"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    background: "linear-gradient(135deg, hsl(0 72% 48%) 0%, hsl(20 60% 40%) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Estilo
                </span>
              </h1>

              <h1
                className="text-[52px] leading-[0.95] tracking-[-0.03em] font-light mt-1"
                style={{ color: "hsl(0 0% 10%)" }}
              >
                Começa
              </h1>

              <h1
                className="text-[52px] leading-[0.95] tracking-[-0.03em] font-medium mt-1"
                style={{ color: "hsl(0 0% 10%)" }}
              >
                Aqui<span style={{ color: "hsl(0 72% 48%)" }}>.</span>
              </h1>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-[14px] leading-[1.6] font-normal mt-8 max-w-[280px]"
              style={{ color: "hsl(0 0% 45%)" }}
            >
              Encontre sua barbearia, agende em segundos
              e saia com o visual que você merece.
            </motion.p>
          </div>

          {/* Bottom — CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 w-full flex justify-center mb-4"
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
