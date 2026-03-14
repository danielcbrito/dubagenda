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
        className="relative w-full h-full overflow-hidden bg-white flex flex-col"
        style={{ maxWidth: 480 }}
      >
        {/* Illustrations area — fills all space above footer */}
        <div
          className="flex-1 min-h-0 overflow-hidden px-1 flex flex-col justify-center"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)" }}
        >
          {/* Scene 1: Sad client — stable on small, larger on tall screens */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full flex justify-start"
          >
            <img
              src={sceneClientSad}
              alt="Cliente triste sem lugar pra agendar"
              className="object-contain max-w-none w-[96%] [@media(max-height:620px)]:w-[90%] [@media(min-height:760px)]:w-[112%] [@media(min-height:860px)]:w-[126%]"
              style={{
                height: "auto",
                marginTop: "clamp(10px, 2.6dvh, 22px)",
                marginLeft: "-7%",
              }}
              draggable={false}
            />
          </motion.div>

          {/* Scene 2: Friend with app — stable on small, much larger on tall screens */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="w-full flex justify-end"
            style={{ marginTop: "-3%" }}
          >
            <img
              src={sceneFriendApp}
              alt="Amiga mostrando o app DubAgenda"
              className="object-contain max-w-none w-[102%] [@media(min-height:760px)]:w-[128%] [@media(min-height:860px)]:w-[150%]"
              style={{
                height: "auto",
                marginRight: "-14%",
              }}
              draggable={false}
            />
          </motion.div>
        </div>

        {/* Gradient fade to hide the cut between illustrations and footer */}
        <div
          className="flex-shrink-0 pointer-events-none"
          style={{
            height: 28,
            marginTop: -28,
            background: "linear-gradient(to bottom, transparent, white)",
            position: "relative",
            zIndex: 2,
          }}
        />

        {/* Footer: Label + Title + CTA — fixed at bottom, never changes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="flex-shrink-0 px-6"
          style={{ zIndex: 3, background: "white" }}
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
            className="w-full flex items-center justify-between active:scale-[0.98] transition-transform mb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
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
