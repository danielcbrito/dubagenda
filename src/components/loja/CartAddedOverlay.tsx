import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useState, useCallback, useRef } from "react";

let globalShow: ((name: string) => void) | null = null;

export function showCartAddedToast(productName: string) {
  globalShow?.(productName);
}

export function CartAddedOverlay() {
  const [visible, setVisible] = useState(false);
  const [productName, setProductName] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((name: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setProductName(name);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1800);
  }, []);

  globalShow = show;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cart-toast"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 24, stiffness: 380 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          <div className="bg-card/97 backdrop-blur-2xl border border-border/30 rounded-3xl px-10 py-8 flex flex-col items-center gap-4 shadow-2xl shadow-foreground/8 min-w-[260px] max-w-[300px]">
            {/* Animated check inside cart circle */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 260, delay: 0.05 }}
              className="w-[72px] h-[72px] rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center relative"
            >
              {/* Cart bag shape */}
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path
                  d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="currentColor"
                  fillOpacity="0.08"
                />
                <path
                  d="M3 6h18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 10a4 4 0 01-8 0"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Checkmark badge */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 14, stiffness: 300, delay: 0.2 }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
              >
                <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
              </motion.div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-base font-bold text-foreground text-center tracking-tight"
            >
              Adicionado ao carrinho
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-muted-foreground text-center line-clamp-2 leading-relaxed max-w-[220px]"
            >
              {productName}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
