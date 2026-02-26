import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, MapPin, ChevronRight } from "lucide-react";

import landingHero from "@/assets/landing-hero-new.jpg";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverflowY: html.style.overflowY,
      htmlPosition: html.style.position,
      htmlHeight: html.style.height,
      htmlTouchAction: html.style.getPropertyValue("touch-action"),
      bodyOverflow: body.style.overflow,
      bodyOverflowY: body.style.overflowY,
      bodyPosition: body.style.position,
      bodyHeight: body.style.height,
      bodyTouchAction: body.style.getPropertyValue("touch-action"),
      bodyWebkitScroll: body.style.getPropertyValue("-webkit-overflow-scrolling"),
    };

    html.classList.remove("lock-scroll");
    body.classList.remove("lock-scroll");

    html.style.overflow = "auto";
    html.style.overflowY = "auto";
    html.style.position = "relative";
    html.style.height = "auto";
    html.style.setProperty("touch-action", "pan-y");

    body.style.overflow = "auto";
    body.style.overflowY = "auto";
    body.style.position = "relative";
    body.style.height = "auto";
    body.style.setProperty("touch-action", "pan-y");
    body.style.setProperty("-webkit-overflow-scrolling", "touch");

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overflowY = prev.htmlOverflowY;
      html.style.position = prev.htmlPosition;
      html.style.height = prev.htmlHeight;

      if (prev.htmlTouchAction) {
        html.style.setProperty("touch-action", prev.htmlTouchAction);
      } else {
        html.style.removeProperty("touch-action");
      }

      body.style.overflow = prev.bodyOverflow;
      body.style.overflowY = prev.bodyOverflowY;
      body.style.position = prev.bodyPosition;
      body.style.height = prev.bodyHeight;

      if (prev.bodyTouchAction) {
        body.style.setProperty("touch-action", prev.bodyTouchAction);
      } else {
        body.style.removeProperty("touch-action");
      }

      if (prev.bodyWebkitScroll) {
        body.style.setProperty("-webkit-overflow-scrolling", prev.bodyWebkitScroll);
      } else {
        body.style.removeProperty("-webkit-overflow-scrolling");
      }
    };
  }, []);

  const handleDiscover = () => {
    navigate("/escolher-barbearia");
  };

  return (
    <main className="relative bg-background touch-pan-y">
      <section className="relative min-h-[calc(100dvh+180px)] flex flex-col">
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={landingHero}
            alt="Fundo premium da DUB Agenda"
            className="w-full h-full object-cover object-top"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" style={{ top: "40%" }} />
        </div>

        <div className="relative z-10 flex flex-col flex-1 px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom,0px)+3rem)]">
          <div className="flex-1 min-h-[38dvh]" />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-10"
          >
            <h1 className="text-[2.25rem] font-bold text-foreground tracking-tight leading-none font-display">
              DUB <span className="text-primary">Agenda</span>
            </h1>
            <p className="text-[13px] text-muted-foreground mt-2.5">Seu estilo, na palma da mão.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm mx-auto space-y-3"
          >
            <button
              onClick={() => navigate("/auth")}
              className="group w-full rounded-2xl active:scale-[0.98] transition-transform duration-150 touch-pan-y"
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
                  <span className="block text-[14px] font-bold text-primary-foreground">Seja Cliente Exclusivo DUB</span>
                  <span className="block text-[11px] text-primary-foreground/60 mt-0.5">Acesse as unidades DUB e agende</span>
                </div>
                <ChevronRight className="w-5 h-5 text-primary-foreground/50 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </button>

            <button
              onClick={handleDiscover}
              className="group w-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm active:scale-[0.98] transition-transform duration-150 touch-pan-y"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-[18px] h-[18px] text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-[14px] font-medium text-foreground">Encontrar Barbearias</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">As melhores perto de você</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-center text-[9px] text-muted-foreground/30 tracking-wider uppercase mt-8"
          >
            © {new Date().getFullYear()} DUB Agenda
          </motion.p>
        </div>
      </section>
    </main>
  );
};

export default Index;



