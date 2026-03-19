import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import sceneClientSad from "@/assets/scene-client-sad.png";
import sceneFriendApp from "@/assets/scene-friend-app.png";
import { AmbientEffects } from "@/components/landing/AmbientEffects";
import { supabase } from "@/integrations/supabase/client";

type ClienteState = "loading" | "autenticado" | "retornante" | "novo";

const Index = () => {
  const navigate = useNavigate();
  const [clienteState, setClienteState] = useState<ClienteState>("loading");

  const lastShopName = typeof window !== "undefined"
    ? localStorage.getItem("dub_last_barbershop_name")
    : null;

  useEffect(() => {
    const detect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/cliente", { replace: true });
          return;
        }
      } catch {
        // Ignore — continue detection
      }

      const hasBarbershop = localStorage.getItem("dub_has_barbershop");
      if (hasBarbershop === "true") {
        setClienteState("retornante");
        return;
      }

      setClienteState("novo");
    };
    detect();
  }, [navigate]);

  // Splash while detecting state
  if (clienteState === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div
        className="relative w-full h-full overflow-hidden bg-background flex flex-col"
        style={{ maxWidth: 480 }}
      >
        {/* ═══ ILLUSTRATIONS ═══ */}
        <div
          className="flex-1 min-h-0 relative overflow-hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <AmbientEffects />

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
            style={{
              top: "clamp(6%, 8vh, 12%)",
              left: "clamp(-14%, -10vw, -6%)",
              width: "clamp(88%, 100vw, 120%)",
              height: "clamp(42%, 48vh, 56%)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
            }}
          >
            <img
              src={sceneClientSad}
              alt="Cliente triste"
              draggable={false}
              className="w-full h-full block dark:invert dark:brightness-90"
              style={{ objectFit: "contain", objectPosition: "left top" }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
            style={{
              bottom: "clamp(-4%, -2vh, 0%)",
              right: "clamp(-16%, -10vw, -6%)",
              width: "clamp(92%, 106vw, 126%)",
              height: "clamp(44%, 52vh, 60%)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
            }}
          >
            <img
              src={sceneFriendApp}
              alt="Amiga mostrando o app"
              draggable={false}
              className="w-full h-full block dark:invert dark:brightness-90"
              style={{ objectFit: "contain", objectPosition: "right bottom" }}
            />
          </motion.div>
        </div>

        {/* Gradient fade into footer */}
        <div
          className="flex-shrink-0 pointer-events-none"
          style={{
            height: 60,
            marginTop: -60,
            background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
            position: "relative",
            zIndex: 2,
          }}
        />

        {/* ═══ FOOTER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="flex-shrink-0 px-6 bg-background"
          style={{ zIndex: 3 }}
        >
          <span
            className="block mb-1.5 text-[10px] font-semibold text-muted-foreground/40 uppercase"
            style={{ letterSpacing: "2.5px" }}
          >
            DUB AGENDA
          </span>

          <div className="flex flex-col items-start gap-1 mb-5">
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
              {clienteState === "retornante" ? (
                <>
                  Sua barbearia{" "}
                  <span className="text-primary">te espera.</span>
                </>
              ) : (
                <>
                  Encontre o barbeiro{" "}
                  <em style={{ fontStyle: "italic" }}>certo</em>
                  <br />
                  perto{" "}
                  <span className="text-primary">de você.</span>
                </>
              )}
            </h1>
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed m-0">
              {clienteState === "retornante"
                ? "Entre para agendar em segundos."
                : "Agendamento sem ligação, sem espera."}
            </p>
          </div>

          {clienteState === "retornante" ? (
            <div
              className="flex flex-col gap-2.5"
              style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
            >
              {/* Primary — return to barbershop */}
              <button
                onClick={() => navigate("/auth?mode=login&context=returning")}
                className="w-full flex items-center justify-between active:scale-[0.97] transition-all"
                style={{
                  fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  borderRadius: 14,
                  padding: "14px 18px",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                <span>Entrar na minha barbearia</span>
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "hsla(var(--primary-foreground) / 0.2)",
                  }}
                >
                  <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                </span>
              </button>

              {lastShopName && (
                <p className="text-center text-[12px] text-muted-foreground/50">
                  Sua barbearia: {lastShopName}
                </p>
              )}

              {/* Secondary — find another */}
              <button
                onClick={() => navigate("/escolher-barbearia")}
                className="w-full flex items-center justify-center active:scale-[0.97] transition-all text-muted-foreground"
                style={{
                  fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  background: "transparent",
                  borderRadius: 14,
                  padding: "12px 18px",
                  cursor: "pointer",
                  border: "1.5px solid hsl(var(--border))",
                }}
              >
                Encontrar outra barbearia
              </button>
            </div>
          ) : (
            /* New visitor — original CTA */
            <button
              onClick={() => navigate("/escolher-barbearia")}
              className="w-full flex items-center justify-between active:scale-[0.97] transition-all border-foreground text-foreground"
              style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 700,
                fontSize: 15,
                background: "transparent",
                borderRadius: 14,
                padding: "14px 18px",
                borderWidth: "1.8px",
                borderStyle: "solid",
                cursor: "pointer",
                marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
              }}
            >
              <span>Encontrar Barbearias</span>
              <span
                className="flex items-center justify-center bg-foreground"
                style={{ width: 28, height: 28, borderRadius: 8 }}
              >
                <ArrowRight className="w-3.5 h-3.5 text-background" />
              </span>
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
