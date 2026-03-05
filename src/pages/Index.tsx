import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ArrowRight } from "lucide-react";

import landingHero from "@/assets/landing-hero-app.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <main className="relative flex-1 flex flex-col">
        {/* Background image — top portion */}
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={landingHero}
            alt="DUB Agenda — Agendamento premium"
            className="w-full h-full object-cover object-[center_0%] md:object-[center_15%]"
            loading="eager"
          />
          {/* Gradient fade — starts at 45% for more image visibility */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent"
            style={{ top: "40%" }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <div className="flex-1" />

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-8"
          >
            <h1 className="text-[2.5rem] font-bold text-foreground tracking-tight leading-none font-display">
              DUB <span className="text-primary">Agenda</span>
            </h1>
            <p className="text-[13px] text-foreground/70 mt-2">
              Seu estilo, na palma da mão.
            </p>
          </motion.div>

          {/* CTAs — clean minimal pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm mx-auto space-y-3"
          >
            {/* Primary CTA */}
            <button
              onClick={() => navigate("/auth")}
              className="group w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl bg-foreground text-background active:scale-[0.97] transition-all duration-200"
            >
              <Scissors className="w-4.5 h-4.5 opacity-80" strokeWidth={2} />
              <span className="flex-1 text-left text-[14px] font-semibold tracking-tight">
                Seja Cliente Exclusivo
              </span>
              <ArrowRight className="w-4 h-4 opacity-40 group-active:translate-x-0.5 transition-transform" />
            </button>

            {/* Secondary CTA */}
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="group w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl border border-foreground/15 bg-background/60 backdrop-blur-md active:scale-[0.97] transition-all duration-200"
            >
              <MapPin className="w-4.5 h-4.5 text-foreground/60" strokeWidth={2} />
              <span className="flex-1 text-left text-[14px] font-medium text-foreground/90 tracking-tight">
                Encontrar Barbearias
              </span>
              <ArrowRight className="w-4 h-4 text-foreground/30 group-active:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-center text-[9px] text-muted-foreground/30 tracking-wider uppercase mt-6"
          >
            © {new Date().getFullYear()} DUB Agenda
          </motion.p>
        </div>
      </main>
    </div>
  );
};

export default Index;
