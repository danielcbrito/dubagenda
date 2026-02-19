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
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex-shrink-0 overflow-hidden"
        >
          {/* Left accent border + content */}
          <div
            className="w-full flex items-center gap-3 px-4 py-3"
            style={{
              background: "hsl(36 90% 13%)",
              borderBottom: "1px solid hsl(38 80% 22%)",
              borderLeft: "3px solid hsl(40 95% 52%)",
            }}
          >
            {/* Icon */}
            <AlertTriangle
              className="flex-shrink-0 w-4 h-4"
              style={{ color: "hsl(40 95% 55%)" }}
              strokeWidth={2.2}
            />

            {/* Text block */}
            <div className="flex-1 min-w-0">
              <p
                className="text-[9px] font-bold uppercase tracking-[0.16em] leading-none mb-1"
                style={{ color: "hsl(40 80% 50%)" }}
              >
                Aviso
              </p>
              <p
                className="text-[12px] font-medium leading-snug"
                style={{ color: "hsl(40 30% 85%)" }}
              >
                {message}
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setDismissed(true)}
              aria-label="Fechar aviso"
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <X
                className="w-3.5 h-3.5"
                style={{ color: "hsl(40 30% 70%)" }}
                strokeWidth={2}
              />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
