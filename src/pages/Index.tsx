import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ChevronRight } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";
import landingHero from "@/assets/landing-hero-tools.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="relative min-h-screen flex flex-col">
        {/* Background */}
        <div className="absolute inset-0">
          <img
            src={landingHero}
            alt=""
            className="w-full h-full object-cover object-center"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 px-6 pt-[env(safe-area-inset-top)]">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center pt-14"
          >
            <img
              src={logoDub}
              alt="DUB"
              className="w-[72px] h-[72px] object-contain drop-shadow-2xl"
            />
          </motion.div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-10"
          >
            <h1 className="text-[2.25rem] font-bold text-foreground tracking-tight leading-none font-display">
              DUB <span className="text-primary">Agenda</span>
            </h1>
            <p className="text-[13px] text-muted-foreground mt-2.5">
              Seu estilo, na palma da mão.
            </p>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm mx-auto space-y-3"
          >
            {/* Primary — Seja Cliente */}
            <button
              onClick={() => navigate("/auth")}
              className="group w-full rounded-2xl active:scale-[0.98] transition-transform duration-150"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-glow-red)",
              }}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
                  <Scissors className="w-[18px] h-[18px] text-primary-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-[14px] font-bold text-primary-foreground">
                    Seja Cliente Exclusivo DUB
                  </span>
                  <span className="block text-[11px] text-primary-foreground/60 mt-0.5">
                    Acesse as unidades DUB e agende
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-primary-foreground/50 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </button>

            {/* Secondary — Encontrar Barbearias */}
            <button
              onClick={() => navigate("/auth?mode=signup&origin=discover")}
              className="group w-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm active:scale-[0.98] transition-transform duration-150"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-[18px] h-[18px] text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-[14px] font-medium text-foreground">
                    Encontrar Barbearias
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    As melhores perto de você
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-center text-[9px] text-muted-foreground/30 tracking-wider uppercase mt-8 pb-8"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
          >
            © {new Date().getFullYear()} DUB Agenda
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default Index;
