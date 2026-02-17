import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ChevronRight, Star, Shield, Clock } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";
import landingHero from "@/assets/landing-hero.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col">
        {/* Background Image with overlay */}
        <div className="absolute inset-0">
          <img
            src={landingHero}
            alt=""
            className="w-full h-full object-cover object-top"
            loading="eager"
          />
          {/* Multi-layer gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 px-6 pt-[env(safe-area-inset-top)]">
          {/* Top Logo Area */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center pt-10 pb-4"
          >
            <img
              src={logoDub}
              alt="DUB"
              className="w-16 h-16 object-contain drop-shadow-2xl"
            />
          </motion.div>

          {/* Spacer to push content down */}
          <div className="flex-1 min-h-[30vh]" />

          {/* Brand Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-center mb-3"
          >
            <p className="text-[10px] font-semibold text-primary uppercase tracking-[0.35em] mb-3">
              EXPERIÊNCIA PREMIUM
            </p>
            <h1 className="text-4xl font-bold text-foreground tracking-tight leading-[1.1] font-display">
              Barbearia{" "}
              <span className="text-primary">DUB</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-[280px] mx-auto leading-relaxed">
              Estilo, precisão e atendimento exclusivo em um só lugar.
            </p>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex items-center justify-center gap-5 mt-4 mb-8"
          >
            {[
              { icon: Star, label: "5.0" },
              { icon: Shield, label: "Seguro" },
              { icon: Clock, label: "Rápido" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <item.icon className="w-3.5 h-3.5 text-primary/80" />
                <span className="text-[11px] text-muted-foreground font-medium">
                  {item.label}
                </span>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full max-w-sm mx-auto space-y-3 mb-6"
          >
            {/* Primary CTA — Cliente Exclusivo */}
            <button
              onClick={() => navigate("/auth")}
              className="group w-full relative overflow-hidden rounded-2xl bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all duration-200"
            >
              <div className="relative flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
                    <Scissors className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[13px] font-bold text-primary-foreground tracking-wide">
                      Seja Cliente Exclusivo
                    </span>
                    <span className="block text-[10px] text-primary-foreground/70 font-medium mt-0.5">
                      Agende com seu barbeiro favorito
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-0.5 transition-transform" />
              </div>
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </button>

            {/* Secondary CTA — Encontrar Barbearias (Disabled) */}
            <button
              disabled
              className="group w-full relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm cursor-not-allowed opacity-60"
            >
              <div className="relative flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[13px] font-semibold text-foreground/70 tracking-wide">
                      Encontrar Barbearias
                    </span>
                    <span className="block text-[10px] text-muted-foreground font-medium mt-0.5">
                      Descubra as melhores perto de você
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-primary/80 uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-full">
                  Em breve
                </span>
              </div>
            </button>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="text-center pb-8"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
          >
            <p className="text-[10px] text-muted-foreground/50 tracking-wider">
              © {new Date().getFullYear()} BARBEARIA DUB • TODOS OS DIREITOS RESERVADOS
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
