import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ChevronRight, Star, Shield, Clock, Sparkles } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";
import landingHero from "@/assets/landing-hero-tools.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col">
        {/* Background Image with premium overlays */}
        <div className="absolute inset-0">
          <img
            src={landingHero}
            alt=""
            className="w-full h-full object-cover object-center scale-110"
            loading="eager"
          />
          {/* Multi-layer gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          {/* Subtle radial vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at center top, transparent 30%, hsl(var(--background)) 85%)",
            }}
          />
        </div>

        {/* Animated ambient glow */}
        <motion.div
          animate={{ opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 px-6 pt-[env(safe-area-inset-top)]">
          {/* Top Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center pt-12 pb-2"
          >
            <div className="relative">
              {/* Logo glow */}
              <div
                className="absolute inset-0 rounded-full opacity-40"
                style={{
                  background: "radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 70%)",
                  filter: "blur(20px)",
                  transform: "scale(2)",
                }}
              />
              <img
                src={logoDub}
                alt="DUB"
                className="w-20 h-20 object-contain drop-shadow-2xl relative z-10"
              />
            </div>
          </motion.div>

          {/* Spacer */}
          <div className="flex-1 min-h-[25vh]" />

          {/* Brand Title Block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-4"
          >
            {/* Decorative line */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-px bg-primary/40" />
              <Sparkles className="w-3 h-3 text-primary/60" />
              <div className="w-8 h-px bg-primary/40" />
            </div>

            <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em] mb-3">
              EXPERIÊNCIA PREMIUM
            </p>
            <h1 className="text-[2.5rem] font-bold text-foreground tracking-tight leading-[1.05] font-display">
              Barbearia{" "}
              <span className="text-primary relative">
                DUB
                {/* Underline glow */}
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              </span>
            </h1>
            <p className="text-[13px] text-muted-foreground mt-3 max-w-[260px] mx-auto leading-relaxed">
              Onde estilo encontra precisão.
              <br />
              <span className="text-foreground/70 font-medium">Atendimento exclusivo.</span>
            </p>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-center gap-6 mt-3 mb-8"
          >
            {[
              { icon: Star, label: "5.0 Avaliações" },
              { icon: Shield, label: "100% Seguro" },
              { icon: Clock, label: "Agendamento Rápido" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-1.5"
              >
                <item.icon className="w-3 h-3 text-primary/70" />
                <span className="text-[10px] text-muted-foreground/80 font-medium">
                  {item.label}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm mx-auto space-y-3 mb-5"
          >
            {/* Primary CTA — Cliente Exclusivo da DUB */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/auth")}
              className="group w-full relative overflow-hidden rounded-2xl active:brightness-90 transition-all duration-200"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-glow-red)",
              }}
            >
              {/* Shine sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/[0.08] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

              <div className="relative flex items-center justify-between px-5 py-[18px]">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center border border-primary-foreground/10">
                    <Scissors className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[14px] font-bold text-primary-foreground tracking-wide">
                      Seja Cliente Exclusivo
                    </span>
                    <span className="block text-[10px] text-primary-foreground/65 font-medium mt-0.5 tracking-wide">
                      Agende na Barbearia DUB
                    </span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                  <ChevronRight className="w-4 h-4 text-primary-foreground/80 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.button>

            {/* Secondary CTA — Encontrar Barbearias (Em breve) */}
            <button
              disabled
              className="w-full relative overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm cursor-not-allowed"
            >
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[12px] font-medium text-foreground/40">
                      Encontrar Barbearias
                    </span>
                    <span className="block text-[9px] text-muted-foreground/40 mt-0.5">
                      Descubra as melhores perto de você
                    </span>
                  </div>
                </div>
                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest bg-muted/40 px-2 py-0.5 rounded-full">
                  Em breve
                </span>
              </div>
            </button>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center pb-8"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
          >
            <p className="text-[9px] text-muted-foreground/40 tracking-[0.2em] uppercase">
              © {new Date().getFullYear()} Barbearia DUB • Todos os direitos reservados
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
