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
          <div
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5"
            style={{
              background: "hsl(40 100% 50%)",
              borderBottom: "1px solid hsl(38 100% 42%)",
            }}
          >
            {/* Icon + Text */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <AlertTriangle
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "hsl(30 60% 15%)" }}
                strokeWidth={2.5}
              />
              <p
                className="text-[12px] font-semibold leading-snug"
                style={{ color: "hsl(30 60% 12%)" }}
              >
                {message}
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              aria-label="Fechar aviso"
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: "rgba(0,0,0,0.12)" }}
            >
              <X
                className="w-3 h-3"
                style={{ color: "hsl(30 60% 15%)" }}
                strokeWidth={2.5}
              />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
