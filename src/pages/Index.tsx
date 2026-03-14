import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SketchClient } from "@/components/landing/SketchClient";
import { SketchBarber } from "@/components/landing/SketchBarber";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">
      {/* ── Scrollable content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-32">

          {/* ── Speech Bubbles ── */}
          <div className="flex flex-col gap-3 mb-2">
            {/* Bubble 1 — Client */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="self-start max-w-[65%] relative"
            >
              <div
                className="rounded-2xl border border-[hsl(0_0%_88%)] px-4 py-2.5"
                style={{ background: "hsl(0 0% 98%)" }}
              >
                <p style={{ fontFamily: "Caveat, cursive", fontWeight: 700, fontSize: 12, color: "#111", lineHeight: 1.35 }}>
                  Quero encontrar uma barbearia perto de mim!
                </p>
              </div>
              {/* Tail */}
              <div
                className="absolute -bottom-1.5 left-6 w-3 h-3 border-b border-r border-[hsl(0_0%_88%)] rotate-45"
                style={{ background: "hsl(0 0% 98%)" }}
              />
            </motion.div>

            {/* Bubble 2 — Barber */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.8 }}
              className="self-end max-w-[65%] relative"
            >
              <div
                className="rounded-2xl border border-[hsl(0_0%_88%)] px-4 py-2.5"
                style={{ background: "hsl(0 0% 98%)" }}
              >
                <p style={{ fontFamily: "Caveat, cursive", fontWeight: 700, fontSize: 12, color: "#111", lineHeight: 1.35 }}>
                  Usa o DUB! Agende na hora pelo app ✓
                </p>
              </div>
              {/* Tail */}
              <div
                className="absolute -bottom-1.5 right-6 w-3 h-3 border-b border-l border-[hsl(0_0%_88%)] -rotate-45"
                style={{ background: "hsl(0 0% 98%)" }}
              />
            </motion.div>
          </div>

          {/* ── Characters ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-end justify-center gap-0 relative my-2"
          >
            <SketchClient />
            <div className="-ml-6">
              <SketchBarber />
            </div>
          </motion.div>

          {/* ── Text Section — left aligned ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col items-start mt-4 gap-2"
          >
            {/* Label */}
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: 10,
                color: "#bbb",
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

      {/* ── CTA Button (fixed bottom) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+22px)] pt-4"
        style={{ background: "linear-gradient(to top, white 60%, transparent)" }}
      >
        <button
          onClick={() => navigate("/escolher-barbearia")}
          className="w-full flex items-center justify-between"
          style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "#111",
            background: "transparent",
            borderRadius: 14,
            padding: "13px 18px",
            border: "1.8px solid #111",
            cursor: "pointer",
          }}
        >
          <span>Encontrar Barbearias</span>
          <span
            className="flex items-center justify-center"
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
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
