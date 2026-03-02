import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoDub from "@/assets/logo-dub.png";
import { useEffect, useState } from "react";

interface InstabilityScreenProps {
  /** "database" = 20min, qualquer outro = 10min */
  errorType?: "database" | "app";
  onRetry?: () => void;
}

export function InstabilityScreen({ errorType = "app", onRetry }: InstabilityScreenProps) {
  const waitMinutes = errorType === "database" ? 20 : 10;
  const [secondsLeft, setSecondsLeft] = useState(waitMinutes * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-reload quando timer acabar
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex flex-col items-center text-center max-w-sm w-full"
      >
        {/* Logo */}
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          src={logoDub}
          alt="Barbearia DUB"
          className="w-16 h-16 object-contain mb-5"
        />

        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 mb-5"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-[11px] font-semibold text-destructive tracking-wide uppercase">
            Instabilidade detectada
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-lg font-semibold text-foreground mb-2"
        >
          Estamos ajustando as coisas
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-muted-foreground mb-6 leading-relaxed"
        >
          Nosso sistema encontrou uma instabilidade temporária.
          <br />
          Por favor, volte em alguns minutos.
        </motion.p>

        {/* Timer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col items-center gap-1.5 mb-8"
        >
          <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Tempo estimado
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {String(minutes).padStart(2, "0")}
            </span>
            <span className="text-lg text-muted-foreground/40 font-medium">:</span>
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {String(seconds).padStart(2, "0")}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/40">
            A página recarregará automaticamente
          </span>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.4 }}
          className="w-12 h-px bg-border mb-6"
        />

        {/* Retry button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="w-full"
        >
          <Button
            onClick={() => {
              if (onRetry) {
                onRetry();
              } else {
                window.location.reload();
              }
            }}
            variant="outline"
            className="w-full h-11 text-sm font-medium gap-2 border-border/50 hover:bg-accent/50 active:scale-[0.98] transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-4 text-muted-foreground/40 text-[10px] tracking-wide uppercase"
      >
        Agradecemos a paciência
      </motion.p>
    </div>
  );
}
