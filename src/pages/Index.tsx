import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";
import { AmbientEffects } from "@/components/landing/AmbientEffects";

const Index = () => {
  const navigate = useNavigate();

  const handleJaTenhoBarbearia = () => {
    navigate('/auth?mode=login');
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div
        className="relative w-full h-full overflow-hidden bg-background flex flex-col"
        style={{ maxWidth: 480 }}
      >
        {/* ═══ ILLUSTRATIONS ═══ */}
        <div
          className="flex-1 min-h-0 relative overflow-hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <AmbientEffects />

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
            style={{
              top: "clamp(2%, 4vh, 8%)",
              left: "clamp(-12%, -8vw, -4%)",
              width: "clamp(82%, 92vw, 108%)",
              height: "clamp(36%, 40vh, 48%)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
            }}
          >
            <img
              src={sceneClientSad}
              alt="Cliente triste"
              draggable={false}
              className="w-full h-full block dark:invert dark:brightness-90"
              style={{ objectFit: "contain", objectPosition: "left top" }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
            style={{
              bottom: "clamp(-2%, 0vh, 2%)",
              right: "clamp(-14%, -8vw, -4%)",
              width: "clamp(85%, 98vw, 116%)",
              height: "clamp(40%, 46vh, 54%)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
            }}
          >
            <img
              src={sceneFriendApp}
              alt="Amiga mostrando o app"
              draggable={false}
              className="w-full h-full block dark:invert dark:brightness-90"
              style={{ objectFit: "contain", objectPosition: "right bottom" }}
            />
          </motion.div>
        </div>

        {/* Gradient fade into footer */}
        <div
          className="flex-shrink-0 pointer-events-none"
          style={{
            height: 60,
            marginTop: -60,
            background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
            position: "relative",
            zIndex: 2,
          }}
        />

        {/* ═══ FOOTER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="flex-shrink-0 px-6 bg-background"
          style={{ zIndex: 3 }}
        >
          <span
            className="block mb-1.5 text-[10px] font-semibold text-muted-foreground/40 uppercase"
            style={{ letterSpacing: "2.5px" }}
          >
            DUB AGENDA
          </span>

          <div className="flex flex-col items-start gap-1 mb-5">
            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 900,
                fontSize: 27,
                lineHeight: 1.18,
                margin: 0,
              }}
              className="text-foreground"
            >
              Encontre o barbeiro{" "}
              <em style={{ fontStyle: "italic" }}>certo</em>
              <br />
              perto{" "}
              <span className="text-primary">de você.</span>
            </h1>
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed m-0">
              Agendamento sem ligação, sem espera.
            </p>
          </div>

          <div
            className="flex flex-col"
            style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
          >
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="w-full flex items-center justify-between active:scale-[0.97] transition-all border-foreground text-foreground"
              style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 700,
                fontSize: 15,
                background: "transparent",
                borderRadius: 14,
                padding: "14px 18px",
                borderWidth: "1.8px",
                borderStyle: "solid",
                cursor: "pointer",
              }}
            >
              <span>Encontrar Barbearias</span>
              <span
                className="flex items-center justify-center bg-foreground"
                style={{ width: 28, height: 28, borderRadius: 8 }}
              >
                <ArrowRight className="w-3.5 h-3.5 text-background" />
              </span>
            </button>

            <button
              onClick={handleJaTenhoBarbearia}
              className="w-full active:opacity-80 transition-opacity text-foreground/70 mt-3"
              style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 600,
                fontSize: 13,
                background: "transparent",
                borderRadius: 14,
                padding: "13px 18px",
                cursor: "pointer",
                border: "1.5px solid hsl(var(--foreground) / 0.2)",
              }}
            >
              Já tenho uma barbearia
            </button>

            <p className="text-center text-[11px] text-muted-foreground/40 mt-2">
              Entre com seu login para agendar
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
