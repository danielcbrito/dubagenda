import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/hooks/useCart";

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
}

export function CartSheet({ open, onClose, items, totalPrice, onUpdateQuantity, onRemoveItem }: CartSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] rounded-t-2xl bg-background border-t border-border/40 overflow-hidden flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
              <h2 className="text-base font-bold text-foreground">Meu Carrinho</h2>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-card border border-border/40 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            </div>

            <div className="h-px bg-border/40" />

            {/* Items */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-32 px-5 pt-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Carrinho vazio</p>
                  <p className="text-xs text-muted-foreground">Adicione produtos para continuar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => {
                    const unitPrice = item.preco_promocional != null && item.preco_promocional < item.preco
                      ? item.preco_promocional
                      : item.preco;
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        className="flex gap-3 items-center"
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-xl bg-muted/20 overflow-hidden flex-shrink-0">
                          {item.imagem_url ? (
                            <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingCart className="w-5 h-5 text-muted-foreground/15" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground line-clamp-1">{item.nome}</p>
                          <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                            R$ {(unitPrice * item.quantidade).toFixed(2)}
                          </p>
                          {/* Qty controls */}
                          <div className="flex items-center gap-2.5 mt-1.5">
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="w-7 h-7 rounded-lg bg-card border border-border/40 flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                            </motion.button>
                            <span className="text-xs font-bold text-foreground tabular-nums w-5 text-center">
                              {item.quantidade}
                            </span>
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              disabled={item.quantidade >= item.estoque}
                              className={cn(
                                "w-7 h-7 rounded-lg bg-card border border-border/40 flex items-center justify-center",
                                item.quantidade >= item.estoque && "opacity-40"
                              )}
                            >
                              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                            </motion.button>
                          </div>
                        </div>

                        {/* Remove */}
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => onRemoveItem(item.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4 text-destructive/70" />
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom CTA */}
            {items.length > 0 && (
              <div
                className="absolute bottom-0 left-0 right-0 bg-background border-t border-border/40 px-5 pt-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Total</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">
                      R$ {totalPrice.toFixed(2)}
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 rounded-xl text-sm font-semibold bg-foreground text-background active:scale-[0.97] transition-all"
                  >
                    Finalizar
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
