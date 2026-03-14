import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

/** Full ambient background — floor, glows, dots, texture */
const AmbientEffects = () => (
  <>
    {/* Floor gradient — warm surface feel */}
    <div
      className="absolute left-0 right-0 bottom-0 pointer-events-none"
      style={{
        height: "35%",
        background: "linear-gradient(to bottom, transparent 0%, hsl(var(--foreground) / 0.015) 40%, hsl(var(--foreground) / 0.035) 100%)",
      }}
    />
    {/* Floor line */}
    <div
      className="absolute left-[8%] right-[8%] pointer-events-none"
      style={{
        bottom: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.08) 30%, hsl(var(--foreground) / 0.1) 50%, hsl(var(--foreground) / 0.08) 70%, transparent)",
      }}
    />
    {/* Floor shadow ellipse */}
    <div
      className="absolute left-[5%] right-[5%] pointer-events-none"
      style={{
        bottom: -4,
        height: 50,
        background: "radial-gradient(ellipse 100% 100% at 50% 0%, hsl(var(--foreground) / 0.04) 0%, transparent 80%)",
      }}
    />

    {/* Large warm glow — top-left behind sad boy */}
    <div
      className="absolute pointer-events-none"
      style={{
        top: "5%",
        left: "-12%",
        width: 320,
        height: 320,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 65%)",
        filter: "blur(60px)",
      }}
    />
    {/* Large cool glow — bottom-right behind friend */}
    <div
      className="absolute pointer-events-none"
      style={{
        bottom: "2%",
        right: "-10%",
        width: 340,
        height: 340,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(210 50% 60% / 0.05) 0%, transparent 65%)",
        filter: "blur(60px)",
      }}
    />
    {/* Center ambient glow */}
    <div
      className="absolute pointer-events-none"
      style={{
        top: "40%",
        left: "20%",
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(var(--primary) / 0.03) 0%, transparent 70%)",
        filter: "blur(40px)",
      }}
    />

    {/* Decorative dots */}
    {[
      { top: "8%", left: "18%", size: 5, op: 0.09, d: 0.4 },
      { top: "20%", right: "14%", size: 4, op: 0.07, d: 0.7 },
      { top: "35%", left: "5%", size: 6, op: 0.06, d: 1.0 },
      { top: "48%", right: "6%", size: 4, op: 0.08, d: 0.6 },
      { top: "12%", right: "32%", size: 3, op: 0.06, d: 1.2 },
      { top: "62%", left: "25%", size: 5, op: 0.05, d: 0.9 },
      { top: "42%", left: "52%", size: 3, op: 0.07, d: 1.4 },
      { top: "70%", right: "20%", size: 4, op: 0.05, d: 1.1 },
      { top: "28%", left: "40%", size: 3, op: 0.04, d: 1.6 },
      { top: "55%", left: "10%", size: 4, op: 0.05, d: 0.8 },
    ].map((dot, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: dot.op, scale: 1 }}
        transition={{ delay: dot.d, duration: 0.6, ease: "easeOut" }}
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

    {/* Subtle diagonal hatching texture */}
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.018]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, transparent, transparent 32px, hsl(var(--foreground)) 32px, hsl(var(--foreground)) 33px)",
      }}
    />

    {/* Horizontal subtle line — mid section */}
    <div
      className="absolute left-[15%] right-[15%] pointer-events-none"
      style={{
        top: "50%",
        height: 1,
        background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.03) 40%, hsl(var(--foreground) / 0.03) 60%, transparent)",
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

          {/* Scene 1: Sad client — BIG, top-left, fully visible */}
          <motion.img
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            draggable={false}
            className="absolute block"
            style={{
              top: "0%",
              left: "-6%",
              width: "110%",
              height: "55%",
              objectFit: "contain",
              objectPosition: "left top",
            }}
          />

          {/* Scene 2: Friend with app — BIG, bottom-right */}
          <motion.img
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            draggable={false}
            className="absolute block"
            style={{
              bottom: "-2%",
              right: "-10%",
              width: "115%",
              height: "58%",
              objectFit: "contain",
              objectPosition: "right bottom",
            }}
          />
        </div>

        {/* Gradient fade */}
        <div
          className="flex-shrink-0 pointer-events-none"
          style={{
            height: 32,
            marginTop: -32,
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
