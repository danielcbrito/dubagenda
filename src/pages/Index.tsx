import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

/** Decorative floating dots / ambient lights */
const AmbientEffects = () => (
  <>
    {/* Soft glow top-left */}
    <div
      className="absolute pointer-events-none"
      style={{
        top: "12%",
        left: "-8%",
        width: 180,
        height: 180,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
        filter: "blur(40px)",
      }}
    />
    {/* Soft glow right */}
    <div
      className="absolute pointer-events-none"
      style={{
        top: "35%",
        right: "-10%",
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(var(--primary) / 0.05) 0%, transparent 70%)",
        filter: "blur(50px)",
      }}
    />
    {/* Small decorative dots */}
    {[
      { top: "18%", left: "12%", size: 4, opacity: 0.12, delay: 0.5 },
      { top: "25%", right: "18%", size: 3, opacity: 0.1, delay: 0.8 },
      { top: "40%", left: "8%", size: 5, opacity: 0.08, delay: 1.1 },
      { top: "52%", right: "10%", size: 3, opacity: 0.1, delay: 0.6 },
      { top: "15%", right: "30%", size: 3, opacity: 0.07, delay: 1.3 },
      { top: "60%", left: "20%", size: 4, opacity: 0.06, delay: 0.9 },
    ].map((dot, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: dot.opacity, scale: 1 }}
        transition={{ delay: dot.delay, duration: 0.6, ease: "easeOut" }}
        className="absolute rounded-full bg-foreground pointer-events-none"
        style={{
          top: dot.top,
          left: (dot as any).left,
          right: (dot as any).right,
          width: dot.size,
          height: dot.size,
        }}
      />
    ))}
    {/* Floor / ground shadow — subtle horizontal line */}
    <div
      className="absolute left-[10%] right-[10%] pointer-events-none"
      style={{
        bottom: "0%",
        height: 24,
        background: "radial-gradient(ellipse 80% 100% at 50% 100%, hsl(var(--foreground) / 0.04) 0%, transparent 100%)",
        filter: "blur(6px)",
      }}
    />
  </>
);

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div
        className="relative w-full h-full overflow-hidden bg-background flex flex-col"
        style={{ maxWidth: 480 }}
      >
        {/* Illustrations area — fills space above footer */}
        <div
          className="flex-1 min-h-0 relative overflow-hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <AmbientEffects />

          {/* Scene 1: Sad client — top-left */}
          <motion.img
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            draggable={false}
            className="absolute block object-contain"
            style={{
              top: "2%",
              left: "-4%",
              width: "78%",
              maxHeight: "54%",
            }}
          />

          {/* Scene 2: Friend with app — bottom-right */}
          <motion.img
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            draggable={false}
            className="absolute block object-contain"
            style={{
              bottom: "0%",
              right: "-6%",
              width: "82%",
              maxHeight: "56%",
            }}
          />
        </div>

        {/* Gradient fade */}
        <div
          className="flex-shrink-0 pointer-events-none"
          style={{
            height: 28,
            marginTop: -28,
            background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
            position: "relative",
            zIndex: 2,
          }}
        />

        {/* Footer: Label + Title + CTA — anchored at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
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

          <div className="flex flex-col items-start gap-1 mb-4">
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

          <button
            onClick={() => navigate("/escolher-barbearia")}
            className="w-full flex items-center justify-between active:scale-[0.98] transition-transform border-foreground text-foreground"
            style={{
              fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              background: "transparent",
              borderRadius: 12,
              padding: "11px 14px",
              borderWidth: "1.6px",
              borderStyle: "solid",
              cursor: "pointer",
              marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
            }}
          >
            <span>Encontrar Barbearias</span>
            <span
              className="flex items-center justify-center bg-foreground"
              style={{ width: 24, height: 24, borderRadius: 7 }}
            >
              <ArrowRight className="w-3 h-3 text-background" />
            </span>
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
