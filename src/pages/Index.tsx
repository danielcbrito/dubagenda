import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">

      {/* ── Top area: Scene 1 (sad client) — top left ── */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="self-start"
          style={{ width: "58%" }}
        >
          <img
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            className="w-full h-auto object-contain"
            draggable={false}
          />
        </motion.div>
      </div>

      {/* ── Middle + Bottom: layered depth container ── */}
      <div className="flex-1 min-h-0 relative">

        {/* Layer 1 (behind): Friend — full body, positioned so legs go behind white block */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="absolute right-2"
          style={{
            bottom: 100,
            width: "65%",
            zIndex: 1,
          }}
        >
          <img
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            className="w-full h-auto object-contain"
            draggable={false}
          />
          {/* Gradient fade at bottom of illustration for smooth transition */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: 80,
              background: "linear-gradient(to bottom, transparent, #ffffff)",
              zIndex: 1,
            }}
          />
        </motion.div>

        {/* Layer 2 (front): White text block — covers lower body like a wall */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="absolute bottom-0 left-0 right-0 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
          style={{
            zIndex: 2,
            background: "#ffffff",
            paddingTop: 20,
          }}
        >
          {/* Text */}
          <div className="flex flex-col items-start gap-1 mb-4">
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
          </div>

          {/* Button */}
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
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
