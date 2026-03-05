import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ArrowRight } from "lucide-react";

import landingTools from "@/assets/landing-tools-hero.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* Image section — top with curved bottom */}
      <div className="relative w-full h-[45vh] min-h-[260px] max-h-[380px] flex-shrink-0">
        <img
          src={landingTools}
          alt="Ferramentas premium de barbearia"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        {/* Curved bottom overlay */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg
            viewBox="0 0 1440 80"
            className="w-full h-auto block"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0 C480,80 960,80 1440,0 L1440,80 L0,80 Z"
              fill="hsl(var(--background))"
            />
          </svg>
        </div>
      </div>

      {/* Content section — white/dark bg */}
      <div className="flex-1 flex flex-col px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mt-6 mb-auto"
        >
          <h1 className="text-[2.5rem] font-bold text-foreground tracking-tight leading-none font-display">
            DUB <span className="text-primary">Agenda</span>
          </h1>
          <p className="text-[13px] text-muted-foreground mt-2">
            Seu estilo, na palma da mão.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm mx-auto space-y-3 mb-6"
        >
          {/* Primary */}
          <button
            onClick={() => navigate("/auth")}
            className="group w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-primary text-primary-foreground active:scale-[0.97] transition-all duration-200 shadow-[0_4px_20px_hsl(var(--primary)/0.3)]"
          >
            <Scissors className="w-[18px] h-[18px] opacity-90" strokeWidth={2} />
            <span className="text-[15px] font-bold tracking-tight">
              Seja Cliente Exclusivo
            </span>
            <ArrowRight className="w-4 h-4 opacity-50 group-active:translate-x-0.5 transition-transform" />
          </button>

          {/* Secondary */}
          <button
            onClick={() => navigate("/escolher-barbearia")}
            className="group w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl border border-border bg-card text-foreground active:scale-[0.97] transition-all duration-200"
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
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center text-[9px] text-muted-foreground/30 tracking-wider uppercase"
        >
          © {new Date().getFullYear()} DUB Agenda
        </motion.p>
      </div>
    </div>
  );
};

export default Index;
