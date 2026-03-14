import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import { AnimeBarber } from "@/components/landing/AnimeBarber";
import { AnimeClient } from "@/components/landing/AnimeClient";

const floatingPills = [
  { emoji: "📍", text: "perto!", top: "2%", left: "8%" },
  { emoji: "★", text: "4.9 top", top: "18%", left: "-4%" },
  { emoji: "📅", text: "livre!", top: "18%", right: "-2%" },
];

const reviews = [
  { name: "Carlos M.", rating: 5, text: "Atendimento impecável e profissional." },
  { name: "Rafael S.", rating: 5, text: "Melhor experiência de barbearia que já tive." },
  { name: "André L.", rating: 4, text: "Praticidade e qualidade em um só lugar." },
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
                background: "rgba(255,179,179,0.15)",
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
                background: "rgba(74,144,217,0.10)",
                top: "5%", right: "-5%",
                filter: "blur(30px)",
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
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
            {/* Main title — 30+ chars, serious tone */}
            <h1
              className="text-center leading-tight"
              style={{
                fontFamily: "Nunito, sans-serif",
                fontWeight: 900,
                fontSize: 26,
                color: "#1a1a2e",
              }}
            >
              Gestão completa para
              <br />
              barbearias que levam
              <br />
              o negócio{" "}
              <span
                style={{
                  fontFamily: "Caveat, cursive",
                  fontWeight: 700,
                  fontSize: 32,
                  color: "#FF4757",
                }}
              >
                a sério
              </span>
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
                maxWidth: 260,
              }}
            >
              Controle de agenda, finanças e clientes
              em uma plataforma profissional e confiável.
            </p>
          </motion.div>

          {/* ── Reviews Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="w-full max-w-[340px] mt-6"
          >
            <span
              className="block text-center mb-3"
              style={{
                fontFamily: "Nunito, sans-serif",
                fontWeight: 800,
                fontSize: 10,
                color: "#aaa",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              Avaliações
            </span>

            <div className="flex flex-col gap-3">
              {reviews.map((review, i) => (
                <motion.div
                  key={review.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.7 + i * 0.08 }}
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    border: "1px solid rgba(240,232,224,0.8)",
                    borderRadius: 14,
                    padding: "12px 14px",
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      style={{
                        fontFamily: "Nunito, sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "#1a1a2e",
                      }}
                    >
                      {review.name}
                    </span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: review.rating }).map((_, j) => (
                        <Star
                          key={j}
                          className="w-3 h-3"
                          fill="#FFD700"
                          stroke="#FFD700"
                        />
                      ))}
                    </div>
                  </div>
                  <p
                    style={{
                      fontFamily: "Nunito, sans-serif",
                      fontWeight: 400,
                      fontSize: 11,
                      color: "#888",
                      lineHeight: 1.4,
                    }}
                  >
                    {review.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── CTA Button (fixed bottom) — no animation ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+22px)] pt-3"
        style={{ background: "linear-gradient(to top, #FFF8F0 70%, transparent)" }}
      >
        <button
          onClick={() => navigate("/escolher-barbearia")}
          className="w-full flex items-center justify-center gap-2"
          style={{
            fontFamily: "Nunito, sans-serif",
            fontWeight: 900,
            fontSize: 13,
            color: "#fff",
            background: "#C0392B",
            borderRadius: 12,
            padding: "13px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(192,57,43,0.25)",
            letterSpacing: "0.02em",
          }}
        >
          Encontrar Barbearias
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Index;
