import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
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
          key="maintenance-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex-shrink-0 px-4 pt-3 pb-1"
        >
          <div
            className="rounded-xl p-3.5 border border-yellow-500/25 relative"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(245,158,11,0.05))",
            }}
          >
            <div className="flex items-start gap-3">
              {/* Icon box */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-yellow-500/20">
                <AlertTriangle className="w-4 h-4 text-yellow-400" strokeWidth={2.2} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-[12px] font-semibold text-yellow-300 leading-snug">
                  Aviso do sistema
                </p>
                <p className="text-[11px] text-yellow-200/60 mt-0.5 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Dismiss button — absolute top-right */}
            <button
              onClick={() => setDismissed(true)}
              aria-label="Fechar aviso"
              className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <X className="w-3 h-3 text-yellow-300/60" strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
