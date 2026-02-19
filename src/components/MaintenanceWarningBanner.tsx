import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Wrench } from "lucide-react";
import { useState } from "react";

interface MaintenanceWarningBannerProps {
  message: string;
}

export function MaintenanceWarningBanner({ message }: MaintenanceWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="w-full overflow-hidden flex-shrink-0"
        >
          {/* Amber solid banner — premium & serious */}
          <div
            className="w-full px-4 py-2.5"
            style={{
              background: "linear-gradient(90deg, hsl(38 95% 46%), hsl(42 100% 52%))",
              boxShadow: "0 2px 12px hsl(40 95% 45% / 0.35)",
            }}
          >
            <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
              {/* Left: icon + message */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.15)" }}
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-950" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.14em] leading-none mb-0.5"
                    style={{ color: "rgba(0,0,0,0.55)" }}
                  >
                    Aviso do Sistema
                  </p>
                  <p
                    className="text-[12px] font-semibold leading-snug truncate"
                    style={{ color: "hsl(30 50% 12%)" }}
                  >
                    {message}
                  </p>
                </div>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => setDismissed(true)}
                aria-label="Fechar aviso"
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors active:scale-90"
                style={{ background: "rgba(0,0,0,0.12)" }}
              >
                <X className="w-3.5 h-3.5" style={{ color: "hsl(30 50% 12%)" }} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

