import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ArrowRight } from "lucide-react";

import landingTools from "@/assets/landing-tools-hero.jpg";
import logoDub from "@/assets/logo-dub.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <div className="relative flex-1 flex flex-col">
        {/* ── Image — top portion, fades into background with gradient ── */}
        <div className="absolute top-0 left-0 right-0 h-[55%] pointer-events-none">
          <img
            src={landingTools}
            alt="Ferramentas premium de barbearia"
            className="w-full h-full object-cover object-center"
            loading="eager"
          />
          {/* Smooth gradient fade — no hard line */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, transparent 30%, hsl(var(--background)) 100%)",
            }}
          />
          {/* Warm ambient glow */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "radial-gradient(ellipse at 20% 20%, rgba(245,158,11,0.5), transparent 60%)",
            }}
          />
        </div>

        {/* Ambient light on content area */}
        <div
          className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[350px] h-[350px] pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
        />

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col flex-1 px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Push content so title overlaps slightly with image fade */}
          <div className="flex-1 min-h-[42%]" />

          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-3"
          >
            <h1 className="text-[2.75rem] font-bold text-foreground tracking-tight leading-none font-display">
              DUB <span className="text-primary">Agenda</span>
            </h1>
            <p className="text-[13px] text-muted-foreground mt-2 tracking-wide">
              Seu estilo, na palma da mão.
            </p>
          </motion.div>

          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="w-8 h-[1.5px] bg-primary/25 mx-auto mt-2 mb-auto rounded-full origin-center"
          />

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm mx-auto space-y-3 mb-5"
          >
            {/* Primary — Exclusivo DUB */}
            <button
              onClick={() => navigate("/auth")}
              className="group relative w-full overflow-hidden rounded-2xl bg-primary text-primary-foreground active:scale-[0.97] transition-all duration-200"
            >
              <div
                className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity pointer-events-none"
                style={{ background: "radial-gradient(circle at center, hsl(var(--primary-foreground) / 0.12), transparent 60%)" }}
              />
              <div className="flex items-center gap-3.5 px-5 py-4">
                <img
                  src={logoDub}
                  alt="DUB"
                  className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-[0_1px_4px_rgba(255,255,255,0.25)]"
                />
                <div className="flex-1 text-left">
                  <span className="block text-[15px] font-bold tracking-tight">
                    Seja Cliente Exclusivo DUB
                  </span>
                  <span className="block text-[11px] opacity-60 mt-0.5">
                    Acesse e agende nas unidades DUB
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-40 group-active:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </button>

            {/* Secondary — Encontrar Barbearias */}
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="group w-full overflow-hidden rounded-2xl border border-border bg-card text-foreground active:scale-[0.97] transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center gap-3.5 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-[18px] h-[18px] text-foreground/70" strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-[15px] font-semibold tracking-tight text-foreground">
                    Encontrar Barbearias
                  </span>
                  <span className="block text-[11px] text-muted-foreground/80 mt-0.5">
                    As melhores perto de você
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-active:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-center text-[9px] text-muted-foreground/25 tracking-wider uppercase"
          >
            © {new Date().getFullYear()} DUB Agenda
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default Index;
