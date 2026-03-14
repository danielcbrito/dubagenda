import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

/** Ambient background effects — floor, glows, dots */
const AmbientEffects = () => (
  <>
    {/* Floor line — subtle ground plane */}
    <div
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        bottom: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent 5%, hsl(var(--foreground) / 0.06) 30%, hsl(var(--foreground) / 0.08) 50%, hsl(var(--foreground) / 0.06) 70%, transparent 95%)",
      }}
    />
    {/* Floor shadow / reflection */}
    <div
      className="absolute left-[5%] right-[5%] pointer-events-none"
      style={{
        bottom: 0,
        height: 40,
        background: "radial-gradient(ellipse 90% 100% at 50% 100%, hsl(var(--foreground) / 0.03) 0%, transparent 100%)",
      }}
    />

    {/* Warm glow behind sad boy (top-left) */}
    <div
      className="absolute pointer-events-none"
      style={{
        top: "8%",
        left: "-5%",
        width: 260,
        height: 260,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(var(--primary) / 0.05) 0%, transparent 70%)",
        filter: "blur(50px)",
      }}
    />
    {/* Cool glow behind friend (bottom-right) */}
    <div
      className="absolute pointer-events-none"
      style={{
        bottom: "5%",
        right: "-8%",
        width: 280,
        height: 280,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(210 60% 60% / 0.04) 0%, transparent 70%)",
        filter: "blur(50px)",
      }}
    />

    {/* Scattered ambient dots */}
    {[
      { top: "10%", left: "15%", size: 4, opacity: 0.08, delay: 0.4 },
      { top: "22%", right: "12%", size: 3, opacity: 0.06, delay: 0.7 },
      { top: "38%", left: "6%", size: 5, opacity: 0.05, delay: 1.0 },
      { top: "50%", right: "8%", size: 3, opacity: 0.07, delay: 0.6 },
      { top: "14%", right: "28%", size: 3, opacity: 0.05, delay: 1.2 },
      { top: "65%", left: "22%", size: 4, opacity: 0.04, delay: 0.9 },
      { top: "44%", left: "50%", size: 2, opacity: 0.06, delay: 1.4 },
      { top: "72%", right: "25%", size: 3, opacity: 0.05, delay: 1.1 },
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

    {/* Subtle diagonal texture lines */}
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.015]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, transparent, transparent 40px, hsl(var(--foreground)) 40px, hsl(var(--foreground)) 41px)",
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
        {/* Illustrations area */}
        <div
          className="flex-1 min-h-0 relative overflow-hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <AmbientEffects />

          {/* Scene 1: Sad client — large, top-left */}
          <motion.img
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            draggable={false}
            className="absolute block object-contain"
            style={{
              top: "-2%",
              left: "-10%",
              width: "100%",
              maxHeight: "62%",
            }}
          />

          {/* Scene 2: Friend with app — large, bottom-right */}
          <motion.img
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            draggable={false}
            className="absolute block object-contain"
            style={{
              bottom: "-4%",
              right: "-14%",
              width: "105%",
              maxHeight: "64%",
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

        {/* Footer */}
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
