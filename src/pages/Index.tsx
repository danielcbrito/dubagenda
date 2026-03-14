import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div
        className="relative w-full h-full overflow-hidden bg-white"
        style={{ maxWidth: 480 }}
      >
        {/* Scene 1: Sad client — top left */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute left-5"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)", width: "55%", zIndex: 1 }}
        >
          <img
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            className="w-full h-auto object-contain mix-blend-multiply"
            draggable={false}
          />
        </motion.div>

        {/* Scene 2: Friend with app — right side, vertically centered in top half */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="absolute right-3"
          style={{ top: "30%", width: "50%", zIndex: 1 }}
        >
          <img
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            className="w-full h-auto object-contain"
            draggable={false}
          />
        </motion.div>

        {/* Footer: Label + Title + CTA — anchored to bottom */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="absolute bottom-0 left-0 right-0 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
          style={{ zIndex: 2 }}
        >
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: 10,
              color: "#ccc",
              letterSpacing: "2.5px",
              textTransform: "uppercase" as const,
              display: "block",
              marginBottom: 6,
            }}
          >
            DUB AGENDA
          </span>

          <div
            style={{
              background: "white",
              borderRadius: "24px 24px 0 0",
              paddingTop: 8,
              boxShadow: "0 -20px 40px rgba(255,255,255,0.95)",
            }}
            className="px-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] -mx-6"
          >
            <div className="flex flex-col items-start gap-1 mb-4">
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
            </div>

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
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
