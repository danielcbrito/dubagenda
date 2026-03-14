import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="relative flex flex-col px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-32 min-h-full">

          {/* ── Client sad — top left ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-[65%] max-w-[280px] -ml-2"
          >
            <img
              src={sceneClientSad}
              alt="Cliente triste sem lugar pra agendar"
              className="w-full h-auto object-contain"
              draggable={false}
            />
          </motion.div>

          {/* ── Spacer to push title+button to bottom ── */}
          <div className="flex-1" />

          {/* ── Title + CTA area with girl overlapping ── */}
          <div className="relative mt-4">
            {/* Friend showing app — bottom right, behind title */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="absolute bottom-8 right--2 w-[60%] max-w-[260px] z-0 pointer-events-none"
            >
              <img
                src={sceneFriendApp}
                alt="Amiga mostrando o app DubAgenda"
                className="w-full h-auto object-contain"
                draggable={false}
              />
            </motion.div>

            {/* Text Section — on top of the girl image */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="relative z-10 flex flex-col items-start gap-1.5 mb-5"
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
      </div>

      {/* ── CTA Button ── */}
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
