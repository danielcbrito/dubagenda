import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Package, Star, ShoppingCart, Minus, Plus, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_promocional: number | null;
  categoria: string;
  imagem_url: string | null;
  estoque: number;
  destaque: boolean;
  tenant_id: string;
}

interface ProductDetailSheetProps {
  produto: Produto | null;
  open: boolean;
  onClose: () => void;
  onAddToCart?: (produto: Produto) => void;
}

export function ProductDetailSheet({ produto, open, onClose, onAddToCart }: ProductDetailSheetProps) {
  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  if (!produto) return null;

  const hasPromo = produto.preco_promocional != null && produto.preco_promocional < produto.preco;
  const discount = hasPromo
    ? Math.round(((produto.preco - produto.preco_promocional!) / produto.preco) * 100)
    : 0;
  const outOfStock = produto.estoque <= 0;
  const finalPrice = hasPromo ? produto.preco_promocional! : produto.preco;

  const handleAddToCart = () => {
    if (!outOfStock && onAddToCart) {
      for (let i = 0; i < qty; i++) onAddToCart(produto);
      setQty(1);

      // Show success feedback
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2000);

      toast.success("Produto adicionado ao carrinho", {
        description: `${qty}x ${produto.nome}`,
        action: {
          label: "Ver carrinho",
          onClick: () => {
            onClose();
            // Small delay to let close animation finish
            setTimeout(() => {
              document.dispatchEvent(new CustomEvent("open-cart"));
            }, 300);
          },
        },
      });
    }
  };

  const handleBuyNow = () => {
    if (!outOfStock && onAddToCart) {
      for (let i = 0; i < qty; i++) onAddToCart(produto);
      setQty(1);
      onClose();
      // Open cart immediately for checkout
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("open-cart"));
      }, 350);
      toast.success("Produto pronto para finalizar!", {
        description: `${qty}x ${produto.nome} — R$ ${(finalPrice * qty).toFixed(2)}`,
      });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          {/* Back button floating over image */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setQty(1); onClose(); }}
            className="absolute top-4 left-4 z-10 w-9 h-9 flex items-center justify-center cursor-pointer rounded-full bg-background/60 backdrop-blur-md shadow-md"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {/* Product image */}
            <div className="relative aspect-square bg-muted/10 overflow-hidden">
              {produto.imagem_url ? (
                <img
                  src={produto.imagem_url}
                  alt={produto.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-muted-foreground/10" />
                </div>
              )}
              {hasPromo && !outOfStock && (
                <div className="absolute top-4 right-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-lg">
                  -{discount}%
                </div>
              )}
              {outOfStock && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Esgotado
                  </span>
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="px-5 pt-5 space-y-4">
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {produto.nome}
              </h2>

              {/* Price */}
              <div className="flex items-end gap-2.5">
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  R$ {finalPrice.toFixed(2)}
                </span>
                {hasPromo && (
                  <span className="text-sm text-muted-foreground line-through tabular-nums mb-0.5">
                    R$ {produto.preco.toFixed(2)}
                  </span>
                )}
              </div>

              {!outOfStock && (
                <p className="text-[11px] text-muted-foreground/60">
                  {produto.estoque <= 5
                    ? `Apenas ${produto.estoque} em estoque`
                    : "Em estoque"}
                </p>
              )}

              {/* Quantity selector */}
              {!outOfStock && (
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                    Quantidade
                  </span>
                  <div className="flex items-center gap-0 rounded-xl border border-border/40 overflow-hidden">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      disabled={qty <= 1}
                      className={cn(
                        "w-9 h-9 flex items-center justify-center cursor-pointer bg-card transition-colors",
                        qty <= 1 && "opacity-30 pointer-events-none"
                      )}
                    >
                      <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                    </motion.button>
                    <span className="text-sm font-bold text-foreground tabular-nums w-10 text-center bg-card">
                      {qty}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setQty((q) => Math.min(produto.estoque, q + 1))}
                      disabled={qty >= produto.estoque}
                      className={cn(
                        "w-9 h-9 flex items-center justify-center cursor-pointer bg-card transition-colors",
                        qty >= produto.estoque && "opacity-30 pointer-events-none"
                      )}
                    >
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </motion.button>
                  </div>
                  {qty > 1 && (
                    <span className="text-xs text-muted-foreground/50 tabular-nums">
                      = R$ {(finalPrice * qty).toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              <div className="h-px bg-border/20" />

              {/* Description */}
              {produto.descricao && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                    Descrição
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {produto.descricao}
                  </p>
                </div>
              )}

              {produto.descricao && <div className="h-px bg-border/20" />}

              {/* Reviews */}
              <div className="space-y-3 pb-6">
                <h3 className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  Avaliações
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="w-4 h-4 text-muted-foreground/15"
                        fill="currentColor"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground/40">
                    Sem avaliações ainda
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom sticky CTA bar */}
          {!outOfStock && (
            <div
              className="flex-shrink-0 bg-background/95 backdrop-blur-lg border-t border-border/30 px-4 pt-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              <div className="flex flex-col gap-2">
                {/* Buy Now — primary */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBuyNow}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-foreground text-background active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Comprar Agora — R$ {(finalPrice * qty).toFixed(2)}
                </motion.button>

                {/* Add to cart — secondary */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddToCart}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2",
                    addedFeedback
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-card border border-border/50 text-foreground active:scale-[0.98]"
                  )}
                >
                  {addedFeedback ? (
                    <>
                      <Check className="w-4 h-4" />
                      Adicionado!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Adicionar ao Carrinho
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
