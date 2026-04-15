import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useMemo } from "react";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      for (const id of next) {
        if (!items.find((i) => i.id === id)) next.delete(id);
      }
      return next;
    });
  }, [items]);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!selectedIds.has(item.id)) return sum;
      const price = item.preco_promocional != null && item.preco_promocional < item.preco
        ? item.preco_promocional
        : item.preco;
      return sum + price * item.quantidade;
    }, 0);
  }, [items, selectedIds]);

  const selectedCount = selectedIds.size;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          {/* Header */}
          <div className="relative flex items-center justify-center px-4 pt-4 pb-3 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="absolute left-4 w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Carrinho{items.length > 0 && (
                <span className="text-muted-foreground/50 font-medium ml-1.5 text-sm tabular-nums">
                  ({items.length})
                </span>
              )}
            </h2>
          </div>

          <div className="h-px bg-border/30" />

          {/* Select all */}
          {items.length > 0 && (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  className="w-[18px] h-[18px] rounded border-border/60 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                />
                <span className="text-xs font-medium text-muted-foreground">Selecionar tudo</span>
              </div>
              <div className="h-px bg-border/20 mx-4" />
            </>
          )}

          {/* Items */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-32">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-muted-foreground/20" />
                </div>
                <p className="text-sm font-semibold text-foreground">Carrinho vazio</p>
                <p className="text-xs text-muted-foreground/60">Adicione produtos para continuar.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {items.map((item, index) => {
                  const unitPrice = item.preco_promocional != null && item.preco_promocional < item.preco
                    ? item.preco_promocional
                    : item.preco;
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        "flex gap-3 items-start py-3.5",
                        index < items.length - 1 && "border-b border-border/15"
                      )}
                    >
                      {/* Checkbox */}
                      <div className="pt-5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="w-[18px] h-[18px] flex-shrink-0 rounded border-border/60 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                        />
                      </div>

                      {/* Image */}
                      <div className="w-[60px] h-[60px] rounded-xl bg-muted/15 overflow-hidden flex-shrink-0 border border-border/20">
                        {item.imagem_url ? (
                          <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-muted-foreground/10" />
                          </div>
                        )}
                      </div>

                      {/* Info + controls */}
                      <div className="flex-1 min-w-0 flex justify-between gap-2">
                        {/* Left: name + price */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{item.nome}</p>
                          <p className="text-sm font-bold text-foreground tabular-nums mt-1.5">
                            R$ {unitPrice.toFixed(2)}
                          </p>
                        </div>

                        {/* Right: quantity stacked above trash */}
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                          <div className="flex items-center gap-0 rounded-lg border border-border/30 overflow-hidden">
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center cursor-pointer bg-card hover:bg-muted/30 transition-colors"
                            >
                              <Minus className="w-3 h-3 text-muted-foreground" />
                            </motion.button>
                            <span className="text-xs font-bold text-foreground tabular-nums w-6 text-center bg-card">
                              {item.quantidade}
                            </span>
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              disabled={item.quantidade >= item.estoque}
                              className={cn(
                                "w-7 h-7 flex items-center justify-center cursor-pointer bg-card hover:bg-muted/30 transition-colors",
                                item.quantidade >= item.estoque && "opacity-30 pointer-events-none"
                              )}
                            >
                              <Plus className="w-3 h-3 text-muted-foreground" />
                            </motion.button>
                          </div>

                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => onRemoveItem(item.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive/50" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          {items.length > 0 && (
            <div
              className="flex-shrink-0 bg-background border-t border-border/30 px-5 pt-3.5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {selectedCount > 0 ? (
                    <>
                      <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-medium">
                        {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"}
                      </p>
                      <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
                        R$ {selectedTotal.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/50">Selecione itens</p>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={selectedCount === 0}
                  className={cn(
                    "px-8 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                    selectedCount > 0
                      ? "bg-foreground text-background active:scale-[0.97]"
                      : "bg-muted text-muted-foreground/40 pointer-events-none"
                  )}
                >
                  Continuar
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
