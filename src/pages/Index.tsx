import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";

/**
 * ESTRATÉGIA DE LEITURA VISUAL (F-pattern + storytelling):
 * 
 * 1. Olho entra pelo menino triste (topo-esquerda, grande, contraste forte)
 *    → Gera empatia: "eu já passei por isso"
 * 
 * 2. Olho desce naturalmente para a menina com celular (centro-direita, maior ainda)
 *    → Apresenta a solução: "tem um jeito fácil"
 * 
 * 3. Olho chega no texto/CTA (base, ancorado)
 *    → Converte: "encontre o barbeiro certo perto de você"
 * 
 * Efeitos ambientais criam "cena" sem distrair do fluxo.
 * Responsividade por altura: telas curtas comprimem, telas altas expandem.
 */

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div
        className="relative w-full h-full overflow-hidden bg-background flex flex-col"
        style={{ maxWidth: 480 }}
      >
        {/* ═══ ILLUSTRATIONS AREA ═══ */}
        <div
          className="flex-1 min-h-0 relative overflow-hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {/* ── AMBIENT BACKGROUND ── */}

          {/* Soft warm blob top-left (behind sad boy) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.1 }}
            className="absolute pointer-events-none"
            style={{
              top: "-5%",
              left: "-15%",
              width: "70%",
              height: "50%",
              borderRadius: "50%",
              background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 60%)",
              filter: "blur(60px)",
            }}
          />

          {/* Cool blob bottom-right (behind friend) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
            className="absolute pointer-events-none"
            style={{
              bottom: "-5%",
              right: "-15%",
              width: "75%",
              height: "55%",
              borderRadius: "50%",
              background: "radial-gradient(circle, hsl(210 50% 60% / 0.045) 0%, transparent 60%)",
              filter: "blur(60px)",
            }}
          />

          {/* Soft center glow — connects the two scenes */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.8 }}
            className="absolute pointer-events-none"
            style={{
              top: "35%",
              left: "15%",
              width: "60%",
              height: "30%",
              borderRadius: "50%",
              background: "radial-gradient(circle, hsl(var(--primary) / 0.025) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />

          {/* Ground plane — subtle gradient at bottom */}
          <div
            className="absolute left-0 right-0 bottom-0 pointer-events-none"
            style={{
              height: "25%",
              background: "linear-gradient(to bottom, transparent 0%, hsl(var(--foreground) / 0.012) 50%, hsl(var(--foreground) / 0.03) 100%)",
            }}
          />

          {/* Ground line */}
          <div
            className="absolute left-[10%] right-[10%] bottom-0 pointer-events-none"
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.07) 30%, hsl(var(--foreground) / 0.09) 50%, hsl(var(--foreground) / 0.07) 70%, transparent)",
            }}
          />

          {/* Small floating circles — like bokeh / ambient particles */}
          {[
            { top: "6%", left: "70%", size: 8, op: 0.04, d: 0.6 },
            { top: "18%", left: "85%", size: 6, op: 0.035, d: 0.9 },
            { top: "45%", left: "3%", size: 10, op: 0.03, d: 1.2 },
            { top: "65%", left: "80%", size: 7, op: 0.035, d: 0.7 },
            { top: "30%", left: "92%", size: 5, op: 0.04, d: 1.0 },
            { top: "75%", left: "15%", size: 6, op: 0.03, d: 1.4 },
          ].map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: c.op, scale: 1 }}
              transition={{ delay: c.d, duration: 0.8, ease: "easeOut" }}
              className="absolute rounded-full pointer-events-none"
              style={{
                top: c.top,
                left: c.left,
                width: c.size,
                height: c.size,
                border: `1px solid hsl(var(--foreground) / 0.06)`,
              }}
            />
          ))}

          {/* ── SCENE 1: Menino triste — GRANDE, topo-esquerda ── */}
          {/* Primeiro ponto de atenção. Olho entra aqui. */}
          <motion.img
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            src={sceneClientSad}
            alt="Cliente triste sem lugar pra agendar"
            draggable={false}
            className="absolute block"
            style={{
              top: "0%",
              left: "-8%",
              width: "120%",
              height: "58%",
              objectFit: "contain",
              objectPosition: "left top",
            }}
          />

          {/* ── SCENE 2: Menina com celular — MAIOR, direita-baixo ── */}
          {/* Segundo ponto de atenção. Apresenta a solução. */}
          <motion.img
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            src={sceneFriendApp}
            alt="Amiga mostrando o app DubAgenda"
            draggable={false}
            className="absolute block"
            style={{
              bottom: "-3%",
              right: "-12%",
              width: "125%",
              height: "62%",
              objectFit: "contain",
              objectPosition: "right bottom",
            }}
          />

          {/* Visual guide arrow — subtle curved path connecting scenes */}
          <motion.svg
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 0.06, pathLength: 1 }}
            transition={{ duration: 1.5, delay: 1.2, ease: "easeInOut" }}
            viewBox="0 0 200 400"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <motion.path
              d="M 60 120 Q 120 200 140 300"
              fill="none"
              stroke="hsl(var(--foreground))"
              strokeWidth="0.8"
              strokeDasharray="4 6"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 1.3, ease: "easeInOut" }}
            />
          </motion.svg>
        </div>

        {/* Gradient fade into footer */}
        <div
          className="flex-shrink-0 pointer-events-none"
          style={{
            height: 40,
            marginTop: -40,
            background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
            position: "relative",
            zIndex: 2,
          }}
        />

        {/* ═══ FOOTER — Terceiro ponto: CONVERSÃO ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
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
