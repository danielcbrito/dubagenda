import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

const ARTBOARD_WIDTH = 390;
const ARTBOARD_HEIGHT = 844;

const Index = () => {
  const navigate = useNavigate();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const widthScale = window.innerWidth / ARTBOARD_WIDTH;
      const heightScale = window.innerHeight / ARTBOARD_HEIGHT;
      setScale(Math.min(widthScale, heightScale));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-white">
      <div
        className="relative overflow-hidden bg-white"
        style={{
          width: ARTBOARD_WIDTH,
          height: ARTBOARD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Scene 1: Sad client — fixed composition position */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute"
          style={{ top: 28, left: 20, width: 225, zIndex: 1 }}
        >
          <img
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            className="w-full h-auto object-contain mix-blend-multiply"
            draggable={false}
          />
        </motion.div>

        {/* Scene 2: Friend with app — fixed composition position */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="absolute"
          style={{ top: 345, right: 22, width: 178, zIndex: 1 }}
        >
          <img
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            className="w-full h-auto object-contain mix-blend-multiply"
            draggable={false}
          />
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="absolute left-0 right-0 bottom-0 px-5 pb-6"
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
              marginBottom: 8,
            }}
          >
            DUB AGENDA
          </span>

          <div
            style={{
              background: "white",
              borderRadius: "24px 24px 0 0",
              paddingTop: 6,
              boxShadow: "0 -20px 40px rgba(255,255,255,0.95)",
            }}
            className="pb-2"
          >
            <div className="flex flex-col items-start gap-1 mb-5">
              <h1
                style={{
                  fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                  fontWeight: 900,
                  fontSize: 54,
                  color: "#111",
                  lineHeight: 1.03,
                  margin: 0,
                  letterSpacing: "-1.2px",
                  transform: "scale(0.5)",
                  transformOrigin: "top left",
                  width: "200%",
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
                  marginTop: -14,
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
                fontSize: 32,
                color: "#111",
                background: "transparent",
                borderRadius: 12,
                padding: "22px 28px",
                border: "1.6px solid #111",
                cursor: "pointer",
                transform: "scale(0.5)",
                transformOrigin: "top left",
                width: "200%",
              }}
            >
              <span>Encontrar Barbearias</span>
              <span
                className="flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "#111",
                }}
              >
                <ArrowRight className="w-6 h-6 text-white" />
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
