import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

const Index = () => {
  const navigate = useNavigate();

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
          {/* Ambient blobs */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "-10%", left: "-20%", width: "80%", height: "60%",
              borderRadius: "50%",
              background: "radial-gradient(circle, hsl(var(--primary) / 0.05) 0%, transparent 60%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: "-10%", right: "-20%", width: "85%", height: "65%",
              borderRadius: "50%",
              background: "radial-gradient(circle, hsl(210 50% 60% / 0.04) 0%, transparent 60%)",
              filter: "blur(60px)",
            }}
          />

          {/* Ground */}
          <div
            className="absolute left-0 right-0 bottom-0 pointer-events-none"
            style={{
              height: "20%",
              background: "linear-gradient(to bottom, transparent, hsl(var(--foreground) / 0.025))",
            }}
          />
          <div
            className="absolute left-[8%] right-[8%] bottom-0 pointer-events-none"
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.08) 50%, transparent)",
            }}
          />

          {/* Bokeh circles */}
          {[
            { top: "8%", left: "75%", s: 8 },
            { top: "45%", left: "5%", s: 10 },
            { top: "70%", left: "82%", s: 6 },
            { top: "25%", left: "90%", s: 5 },
          ].map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.04 }}
              transition={{ delay: 0.6 + i * 0.3, duration: 0.8 }}
              className="absolute rounded-full pointer-events-none"
              style={{
                top: c.top, left: c.left,
                width: c.s, height: c.s,
                border: "1px solid hsl(var(--foreground) / 0.08)",
              }}
            />
          ))}

          {/* ── Menino triste — ESQUERDA, grande porém controlado ── */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
            style={{
              top: "clamp(1%, 2vh, 3%)",
              left: "clamp(-18%, -12vw, -8%)",
              width: "clamp(96%, 118vw, 138%)",
              height: "clamp(50%, 58vh, 66%)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
            }}
          >
            <img
              src={sceneClientSad}
              alt="Cliente triste"
              draggable={false}
              className="w-full h-full block"
              style={{ objectFit: "contain", objectPosition: "left top" }}
            />
          </motion.div>

          {/* ── Menina com celular — DIREITA, grande porém controlado ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
            style={{
              bottom: "clamp(-2%, -1vh, 0%)",
              right: "clamp(-20%, -13vw, -9%)",
              width: "clamp(102%, 122vw, 142%)",
              height: "clamp(52%, 60vh, 68%)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
            }}
          >
            <img
              src={sceneFriendApp}
              alt="Amiga mostrando o app"
              draggable={false}
              className="w-full h-full block"
              style={{ objectFit: "contain", objectPosition: "right bottom" }}
            />
          </motion.div>
        </div>

        {/* Gradient fade */}
        <div
          className="flex-shrink-0 pointer-events-none"
          style={{
            height: 40, marginTop: -40,
            background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
            position: "relative", zIndex: 2,
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
              fontWeight: 700, fontSize: 13,
              background: "transparent", borderRadius: 12,
              padding: "11px 14px", borderWidth: "1.6px", borderStyle: "solid",
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
