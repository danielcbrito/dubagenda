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
        <div className="flex flex-col px-5 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-32">

          {/* ── Comic Panel: Speech Bubbles + Characters ── */}
          <div className="relative">

            {/* Bubble 1 — Client (top-left, blue tint) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: -16 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6, ease: "easeOut" }}
              className="relative z-10 self-start max-w-[66%] mb-2"
            >
              <div
                className="rounded-2xl rounded-bl-md px-3.5 py-2.5"
                style={{
                  background: "#EDF2FA",
                  border: "1.5px solid #D6E2F0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <p style={{
                  fontFamily: "Caveat, cursive", fontWeight: 700,
                  fontSize: 13, color: "#2D3748", lineHeight: 1.4, margin: 0,
                }}>
                  Quero encontrar uma barbearia perto de mim!
                </p>
              </div>
              <svg className="absolute -bottom-[7px] left-5" width="14" height="8" viewBox="0 0 14 8" fill="none">
                <path d="M0 0 L7 8 L14 0" fill="#EDF2FA" stroke="#D6E2F0" strokeWidth="1.5" strokeLinejoin="round" />
                <line x1="0" y1="0" x2="14" y2="0" stroke="#EDF2FA" strokeWidth="2" />
              </svg>
            </motion.div>

            {/* Bubble 2 — Barber (right side, green tint) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 16 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 1.0, ease: "easeOut" }}
              className="relative z-10 self-end ml-auto max-w-[66%] mb-1"
            >
              <div
                className="rounded-2xl rounded-br-md px-3.5 py-2.5"
                style={{
                  background: "#E8F5E9",
                  border: "1.5px solid #C8E6C9",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <p style={{
                  fontFamily: "Caveat, cursive", fontWeight: 700,
                  fontSize: 13, color: "#2D3748", lineHeight: 1.4, margin: 0,
                }}>
                  Usa o DUB! Agende na hora pelo app ✓
                </p>
              </div>
              <svg className="absolute -bottom-[7px] right-5" width="14" height="8" viewBox="0 0 14 8" fill="none">
                <path d="M0 0 L7 8 L14 0" fill="#E8F5E9" stroke="#C8E6C9" strokeWidth="1.5" strokeLinejoin="round" />
                <line x1="0" y1="0" x2="14" y2="0" stroke="#E8F5E9" strokeWidth="2" />
              </svg>
            </motion.div>

            {/* Characters — side by side, overlapping slightly */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-end justify-center -mt-1"
            >
              <div className="relative">
                <SketchClient />
              </div>
              <div className="-ml-6 relative">
                <SketchBarber />
              </div>
            </motion.div>
          </div>

          {/* ── Text Section — left aligned, tight to characters ── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="flex flex-col items-start mt-2 gap-1.5"
          >
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

            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 900,
                fontSize: 27,
                color: "#111",
                lineHeight: 1.18,
                margin: 0,
              }}
            >
              Encontre o barbeiro{" "}
              <em style={{ fontStyle: "italic" }}>certo</em>
              <br />
              perto{" "}
              <span style={{ color: "#E53E3E" }}>de você.</span>
            </h1>

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

      {/* ── CTA Button — fixed bottom, slimmer ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-5"
        style={{ background: "linear-gradient(to top, white 60%, transparent)" }}
      >
        <button
          onClick={() => navigate("/escolher-barbearia")}
          className="w-full flex items-center justify-between active:scale-[0.98] transition-transform"
          style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "#111",
            background: "transparent",
            borderRadius: 12,
            padding: "11px 14px",
            border: "1.6px solid #111",
            cursor: "pointer",
          }}
        >
          <span>Encontrar Barbearias</span>
          <span
            className="flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: "#111",
            }}
          >
            <ArrowRight className="w-3 h-3 text-white" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default Index;
