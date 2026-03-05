import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ArrowRight } from "lucide-react";

import landingTools from "@/assets/landing-tools-hero.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* ── Hero image — top with curved bottom ── */}
      <div className="relative w-full h-[42vh] min-h-[240px] max-h-[360px] flex-shrink-0">
        <img
          src={landingTools}
          alt="Ferramentas premium de barbearia"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />

        {/* Ambient light glow — top left warm */}
        <div
          className="absolute top-0 left-0 w-[60%] h-[70%] pointer-events-none opacity-30"
          style={{
            background: "radial-gradient(ellipse at 15% 20%, rgba(245,158,11,0.4), transparent 70%)",
          }}
        />

        {/* Ambient light glow — bottom right cool */}
        <div
          className="absolute bottom-0 right-0 w-[50%] h-[60%] pointer-events-none opacity-20"
          style={{
            background: "radial-gradient(ellipse at 85% 80%, rgba(239,68,68,0.3), transparent 70%)",
          }}
        />

        {/* Curved bottom */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 90" className="w-full h-auto block" preserveAspectRatio="none">
            <path d="M0,0 C360,90 1080,90 1440,0 L1440,90 L0,90 Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative flex-1 flex flex-col px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] overflow-hidden">
        {/* Subtle ambient glow behind content */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] pointer-events-none opacity-[0.04] dark:opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)",
          }}
        />

        {/* Brand + tagline */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mt-8 mb-2"
        >
          <h1 className="text-[2.75rem] font-bold text-foreground tracking-tight leading-none font-display">
            DUB <span className="text-primary">Agenda</span>
          </h1>
          <p className="text-[13px] text-muted-foreground mt-2.5 tracking-wide">
            Seu estilo, na palma da mão.
          </p>
        </motion.div>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-10 h-[2px] bg-primary/30 mx-auto mt-3 mb-auto rounded-full origin-center"
        />

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm mx-auto space-y-3 mb-6"
        >
          {/* Primary — Exclusivo DUB */}
          <button
            onClick={() => navigate("/auth")}
            className="group relative w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-primary text-primary-foreground active:scale-[0.97] transition-all duration-200 overflow-hidden"
          >
            {/* Button glow */}
            <div
              className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: "radial-gradient(circle at center, hsl(var(--primary-foreground) / 0.1), transparent 60%)",
              }}
            />
            <Scissors className="w-[18px] h-[18px] opacity-90" strokeWidth={2} />
            <span className="text-[15px] font-bold tracking-tight">
              Seja Cliente Exclusivo
            </span>
            <ArrowRight className="w-4 h-4 opacity-50 group-active:translate-x-0.5 transition-transform" />
          </button>

          {/* Secondary — Encontrar */}
          <button
            onClick={() => navigate("/escolher-barbearia")}
            className="group w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl border border-border/60 bg-card/80 text-foreground active:scale-[0.97] transition-all duration-200"
          >
            <MapPin className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={2} />
            <span className="text-[15px] font-medium tracking-tight">
              Encontrar Barbearias
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-active:translate-x-0.5 transition-transform" />
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
  );
};

export default Index;
