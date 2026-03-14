import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimeBarber } from "@/components/landing/AnimeBarber";
import { AnimeClient } from "@/components/landing/AnimeClient";

const floatingPills = [
  { emoji: "📍", text: "perto!", top: "2%", left: "8%" },
  { emoji: "★", text: "4.9 top", top: "18%", left: "-4%" },
  { emoji: "📅", text: "livre!", top: "18%", right: "-2%" },
];

const benefitPills = [
  { emoji: "⚡", text: "Agendamento rápido", accent: true },
  { emoji: "📍", text: "Perto de você", accent: false },
  { emoji: "★", text: "Mais bem avaliadas", accent: false },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#FFF8F0" }}
    >
      {/* ── Top Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-1 flex-shrink-0"
      >
        <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 22, color: "#1a1a2e" }}>
          DUB<span style={{ color: "#FF4757" }}>.</span>
        </span>
        <span
          style={{
            fontFamily: "Nunito, sans-serif",
            fontWeight: 800,
            fontSize: 9,
            color: "#fff",
            background: "#FF4757",
            borderRadius: 20,
            padding: "3px 10px",
            letterSpacing: "0.05em",
          }}
        >
          NOVO
        </span>
      </motion.div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-col items-center px-5 pb-28">

          {/* ── Illustration Section ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative w-full max-w-[340px] mt-2"
            style={{ minHeight: 240 }}
          >
            {/* Blobs */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 140, height: 140,
                background: "rgba(255,179,179,0.2)",
                top: "10%", left: "-5%",
                filter: "blur(30px)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 120, height: 120,
                background: "rgba(74,144,217,0.15)",
                top: "5%", right: "-5%",
                filter: "blur(30px)",
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 100, height: 80,
                background: "rgba(255,203,164,0.25)",
                bottom: "5%", left: "30%",
                filter: "blur(25px)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            />

            {/* Floating pills */}
            {floatingPills.map((pill, i) => (
              <motion.div
                key={pill.text}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                className="absolute z-10"
                style={{
                  top: pill.top,
                  left: pill.left,
                  right: (pill as any).right,
                  fontFamily: "Nunito, sans-serif",
                  fontWeight: 700,
                  fontSize: 11,
                  color: "#1a1a2e",
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 20,
                  padding: "5px 12px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  border: "1px solid rgba(240,232,224,0.8)",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {pill.emoji} {pill.text}
              </motion.div>
            ))}

            {/* Characters */}
            <div className="flex items-end justify-center gap-0 relative z-[1]">
              <AnimeBarber />
              <div className="-ml-4">
                <AnimeClient />
              </div>
            </div>
          </motion.div>

          {/* ── Text Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col items-center mt-4 gap-2.5 w-full"
          >
            {/* Tag */}
            <span
              style={{
                fontFamily: "Caveat, cursive",
                fontWeight: 600,
                fontSize: 15,
                color: "#FF4757",
              }}
            >
              ✦ encontre agora ✦
            </span>

            {/* Main title */}
            <h1
              className="text-center leading-tight"
              style={{
                fontFamily: "Nunito, sans-serif",
                fontWeight: 900,
                fontSize: 28,
                color: "#1a1a2e",
              }}
            >
              Seu próximo
              <br />
              corte{" "}
              <span
                style={{
                  fontFamily: "Caveat, cursive",
                  fontWeight: 700,
                  fontSize: 34,
                  color: "#FF4757",
                }}
              >
                perfeito
              </span>
              <br />
              está aqui
            </h1>

            {/* Subtitle */}
            <p
              className="text-center"
              style={{
                fontFamily: "Nunito, sans-serif",
                fontWeight: 400,
                fontSize: 12,
                color: "#888",
                lineHeight: 1.5,
                maxWidth: 240,
              }}
            >
              Descubra as melhores barbearias
              <br />
              perto de você em segundos.
            </p>

            {/* Benefit pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {benefitPills.map((pill, i) => (
                <motion.span
                  key={pill.text}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.7 + i * 0.08 }}
                  style={{
                    fontFamily: "Nunito, sans-serif",
                    fontWeight: 700,
                    fontSize: 10,
                    color: pill.accent ? "#FF4757" : "#1a1a2e",
                    background: pill.accent ? "#FFF0F0" : "#fff",
                    border: `1px solid ${pill.accent ? "#FF4757" : "#f0e8e0"}`,
                    borderRadius: 20,
                    padding: "5px 12px",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {pill.emoji} {pill.text}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── CTA Button (fixed bottom) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+22px)] pt-3"
        style={{ background: "linear-gradient(to top, #FFF8F0 70%, transparent)" }}
      >
        <motion.button
          onClick={() => navigate("/escolher-barbearia")}
          whileTap={{ scale: 0.97 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-full"
          style={{
            fontFamily: "Nunito, sans-serif",
            fontWeight: 900,
            fontSize: 14,
            color: "#fff",
            background: "#FF4757",
            borderRadius: 20,
            padding: "16px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 6px 24px rgba(255,71,87,0.3)",
          }}
        >
          Encontrar Barbearias →
        </motion.button>
      </motion.div>
    </div>
  );
};

export default Index;
