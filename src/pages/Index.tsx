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
        <div className="flex flex-col px-5 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-28">

          {/* ── Text Section — top, left aligned ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-start gap-1.5 mb-4"
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

          {/* ── Comic Panel: Characters + Bubbles ── */}
          <div className="relative flex items-end justify-center">

            {/* Client character */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative"
            >
              {/* Bubble attached to client — top-left */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="absolute -top-[52px] -left-2 z-20"
                style={{ width: 150 }}
              >
                <div
                  className="rounded-xl rounded-bl-sm px-3 py-2"
                  style={{
                    background: "#EDF2FA",
                    border: "1.4px solid #D6E2F0",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  <p style={{
                    fontFamily: "Caveat, cursive", fontWeight: 700,
                    fontSize: 11.5, color: "#2D3748", lineHeight: 1.35, margin: 0,
                  }}>
                    Quero encontrar uma barbearia perto de mim!
                  </p>
                </div>
                {/* Tail pointing down to client */}
                <svg className="absolute -bottom-[6px] left-4" width="12" height="7" viewBox="0 0 12 7" fill="none">
                  <path d="M0 0 L6 7 L12 0" fill="#EDF2FA" stroke="#D6E2F0" strokeWidth="1.4" strokeLinejoin="round" />
                  <line x1="0" y1="0.5" x2="12" y2="0.5" stroke="#EDF2FA" strokeWidth="2" />
                </svg>
              </motion.div>

              <SketchClient />
            </motion.div>

            {/* Barber character */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="-ml-4 relative"
            >
              {/* Bubble attached to barber — top-right */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 1.2 }}
                className="absolute -top-[42px] -right-2 z-20"
                style={{ width: 148 }}
              >
                <div
                  className="rounded-xl rounded-br-sm px-3 py-2"
                  style={{
                    background: "#E8F5E9",
                    border: "1.4px solid #C8E6C9",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  <p style={{
                    fontFamily: "Caveat, cursive", fontWeight: 700,
                    fontSize: 11.5, color: "#2D3748", lineHeight: 1.35, margin: 0,
                  }}>
                    Usa o DUB! Agende na hora pelo app ✓
                  </p>
                </div>
                {/* Tail pointing down to barber */}
                <svg className="absolute -bottom-[6px] right-4" width="12" height="7" viewBox="0 0 12 7" fill="none">
                  <path d="M0 0 L6 7 L12 0" fill="#E8F5E9" stroke="#C8E6C9" strokeWidth="1.4" strokeLinejoin="round" />
                  <line x1="0" y1="0.5" x2="12" y2="0.5" stroke="#E8F5E9" strokeWidth="2" />
                </svg>
              </motion.div>

              <SketchBarber />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── CTA Button — slim ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+22px)] pt-5"
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
            padding: "10px 14px",
            border: "1.5px solid #111",
            cursor: "pointer",
          }}
        >
          <span>Encontrar Barbearias</span>
          <span
            className="flex items-center justify-center"
            style={{ width: 22, height: 22, borderRadius: 6, background: "#111" }}
          >
            <ArrowRight className="w-3 h-3 text-white" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default Index;
