import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useState, useCallback, useRef } from "react";

let globalShow: ((name: string) => void) | null = null;

/** Call this from anywhere to show the centered cart feedback */
export function showCartAddedToast(productName: string) {
  globalShow?.(productName);
}

/** Mount this once at the app/page level */
export function CartAddedOverlay() {
  const [visible, setVisible] = useState(false);
  const [productName, setProductName] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((name: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setProductName(name);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1600);
  }, []);

  globalShow = show;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cart-toast"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", damping: 22, stiffness: 340 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-border/40 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl shadow-foreground/5 max-w-[240px]">
            {/* Animated cart icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 14, stiffness: 300, delay: 0.05 }}
              className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <ShoppingCart className="w-6 h-6 text-primary" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-bold text-foreground text-center"
            >
              Adicionado ao carrinho
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-[11px] text-muted-foreground text-center line-clamp-2 leading-snug"
            >
              {productName}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-[10px] text-primary/70 font-medium"
            >
              Continue comprando ✨
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
