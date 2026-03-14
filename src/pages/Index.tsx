import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">

      {/* ── Illustrations area — fills available space above the bottom UI ── */}
      <div className="flex-1 min-h-0 relative">

        {/* Scene 1: Sad client — top left */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute left-5"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 2%)",
            width: "min(58%, 280px)",
            zIndex: 1,
          }}
        >
          <img
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            className="w-full h-auto object-contain"
            draggable={false}
          />
        </motion.div>

        {/* Scene 2: Friend with app — right side, overlaps with white wall */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="absolute right-4"
          style={{
            top: "25%",
            width: "min(55%, 260px)",
            zIndex: 1,
          }}
        >
          <img
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            className="w-full h-auto object-contain"
            draggable={false}
          />
        </motion.div>
      </div>

      {/* ── Bottom UI: label + white wall + title + button ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.0 }}
        className="flex-shrink-0 px-6 relative"
        style={{ zIndex: 2 }}
      >
        {/* "DUB AGENDA" label — sits on the transparent bg, above the white wall */}
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

        {/* White wall — extends DOWN well past the content via extra padding-bottom
             and starts a bit higher via negative margin-top + padding-top.
             The title/button stay in place; only the white bg extends further down. */}
        <div
          style={{
            background: "white",
            borderRadius: "24px 24px 0 0",
            paddingTop: 12,
            boxShadow: "0 -30px 50px rgba(255,255,255,0.97)",
          }}
          className="-mx-6 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+28px)]"
        >
          <div className="flex flex-col items-start gap-1 mb-4">
            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 900,
                fontSize: "clamp(20px, 5.5vw, 27px)",
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
                fontSize: "clamp(10px, 2.8vw, 12px)",
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
              fontSize: "clamp(11px, 3vw, 13px)",
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
  );
};

export default Index;
