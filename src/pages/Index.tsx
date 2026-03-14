import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SketchClient } from "@/components/landing/SketchClient";
import { SketchBarber } from "@/components/landing/SketchBarber";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-36">

          {/* ── Speech Bubbles ── */}
          <div className="flex flex-col gap-4 mb-1">
            {/* Bubble 1 — Client (blue tint) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: -12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
              className="self-start max-w-[72%] relative"
            >
              <div
                className="rounded-2xl rounded-bl-md px-4 py-3 shadow-sm"
                style={{ background: "#EDF2FA", border: "1.5px solid #D6E2F0" }}
              >
                <p style={{
                  fontFamily: "Caveat, cursive", fontWeight: 700,
                  fontSize: 13, color: "#2D3748", lineHeight: 1.4,
                }}>
                  Quero encontrar uma barbearia perto de mim!
                </p>
              </div>
              {/* Tail */}
              <svg className="absolute -bottom-2 left-4" width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path d="M0 0 L8 10 L16 0" fill="#EDF2FA" stroke="#D6E2F0" strokeWidth="1.5"
                  strokeLinejoin="round" />
                <line x1="0" y1="0" x2="16" y2="0" stroke="#EDF2FA" strokeWidth="2" />
              </svg>
            </motion.div>

            {/* Bubble 2 — Barber (green tint) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.9, ease: "easeOut" }}
              className="self-end max-w-[72%] relative"
            >
              <div
                className="rounded-2xl rounded-br-md px-4 py-3 shadow-sm"
                style={{ background: "#E8F5E9", border: "1.5px solid #C8E6C9" }}
              >
                <p style={{
                  fontFamily: "Caveat, cursive", fontWeight: 700,
                  fontSize: 13, color: "#2D3748", lineHeight: 1.4,
                }}>
                  Usa o DUB! Agende na hora pelo app ✓
                </p>
              </div>
              {/* Tail */}
              <svg className="absolute -bottom-2 right-4" width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path d="M0 0 L8 10 L16 0" fill="#E8F5E9" stroke="#C8E6C9" strokeWidth="1.5"
                  strokeLinejoin="round" />
                <line x1="0" y1="0" x2="16" y2="0" stroke="#E8F5E9" strokeWidth="2" />
              </svg>
            </motion.div>
          </div>

          {/* ── Characters — larger, centered ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="flex items-end justify-center relative my-1"
          >
            <div className="relative">
              <SketchClient />
            </div>
            <div className="-ml-8 relative">
              <SketchBarber />
            </div>
          </motion.div>

          {/* ── Text Section — left aligned, pushed down ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col items-start mt-6 gap-2"
          >
            {/* Label */}
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: 10,
                color: "#ccc",
                letterSpacing: "2.5px",
                textTransform: "uppercase" as const,
              }}
            >
              DUB AGENDA
            </span>

            {/* Title */}
            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 900,
                fontSize: 27,
                color: "#111",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Encontre o barbeiro{" "}
              <em style={{ fontStyle: "italic" }}>certo</em>
              <br />
              perto{" "}
              <span style={{ color: "#E53E3E" }}>de você.</span>
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 400,
                fontSize: 12,
                color: "#aaa",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Agendamento sem ligação, sem espera.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── CTA Button — fixed, pushed up ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+28px)] pt-4"
        style={{ background: "linear-gradient(to top, white 60%, transparent)" }}
      >
        <button
          onClick={() => navigate("/escolher-barbearia")}
          className="w-full flex items-center justify-between active:scale-[0.98] transition-transform"
          style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "#111",
            background: "transparent",
            borderRadius: 14,
            padding: "14px 18px",
            border: "1.8px solid #111",
            cursor: "pointer",
          }}
        >
          <span>Encontrar Barbearias</span>
          <span
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "#111",
            }}
          >
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default Index;
