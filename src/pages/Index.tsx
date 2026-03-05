import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ArrowRight, Crown } from "lucide-react";

import landingTools from "@/assets/landing-tools-hero.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* Full-screen layout */}
      <div className="relative flex-1 flex flex-col">
        {/* ── Image — diagonal clip from top-left to bottom-right ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 38%, 0 58%)" }}
        >
          <img
            src={landingTools}
            alt="Ferramentas premium de barbearia"
            className="w-full h-full object-cover object-center"
            loading="eager"
          />
          {/* Warm ambient glow */}
          <div
            className="absolute inset-0 opacity-25"
            style={{
              background: "radial-gradient(ellipse at 20% 30%, rgba(245,158,11,0.5), transparent 60%)",
            }}
          />
        </div>

        {/* ── Ambient light effects on background ── */}
        {/* Soft primary glow */}
        <div
          className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)",
          }}
        />
        {/* Subtle warm accent top-right */}
        <div
          className="absolute top-[35%] right-0 w-[200px] h-[200px] pointer-events-none opacity-[0.04] dark:opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, rgba(245,158,11,0.6), transparent 70%)",
          }}
        />

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col flex-1 px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Spacer to push content below image */}
          <div className="flex-1 min-h-[55%]" />

          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-2"
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
            className="w-8 h-[1.5px] bg-primary/25 mx-auto mt-3 mb-auto rounded-full origin-center"
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
              {/* Inner glow on press */}
              <div
                className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity pointer-events-none"
                style={{
                  background: "radial-gradient(circle at center, hsl(var(--primary-foreground) / 0.12), transparent 60%)",
                }}
              />
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-[17px] h-[17px]" strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-[14px] font-bold tracking-tight">
                    Seja Cliente Exclusivo DUB
                  </span>
                  <span className="block text-[11px] opacity-60 mt-0.5">
                    Acesse e agende nas unidades DUB
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-40 group-active:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </button>

            {/* Secondary — Encontrar */}
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="group w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-border/50 bg-card/80 text-foreground active:scale-[0.97] transition-all duration-200"
            >
              <MapPin className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" strokeWidth={2} />
              <span className="flex-1 text-left text-[14px] font-medium tracking-tight">
                Encontrar Barbearias
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-active:translate-x-0.5 transition-transform flex-shrink-0" />
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
