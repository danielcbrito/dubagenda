import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Star, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const categoryLabels: Record<string, string> = {
  cabelo: "Cabelo",
  barba: "Barba",
  skincare: "Skincare",
  acessorios: "Acessórios",
  geral: "Geral",
};

export function ProductDetailSheet({ produto, open, onClose }: ProductDetailSheetProps) {
  if (!produto) return null;

  const hasPromo = produto.preco_promocional != null && produto.preco_promocional < produto.preco;
  const discount = hasPromo
    ? Math.round(((produto.preco - produto.preco_promocional!) / produto.preco) * 100)
    : 0;
  const outOfStock = produto.estoque <= 0;
  const finalPrice = hasPromo ? produto.preco_promocional! : produto.preco;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
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

            {/* Close button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-card border border-border/40 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </motion.button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-32">
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
                  <div className="absolute top-4 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
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
              <div className="px-5 pt-4 space-y-4">
                {/* Name */}
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {produto.nome}
                </h2>

                {/* Price block */}
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

                {/* Stock info */}
                {!outOfStock && (
                  <p className="text-[11px] text-muted-foreground/60">
                    {produto.estoque <= 5
                      ? `Apenas ${produto.estoque} em estoque`
                      : "Em estoque"}
                  </p>
                )}

                {/* Divider */}
                <div className="h-px bg-border/40" />

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

                {/* Divider */}
                <div className="h-px bg-border/40" />

                {/* Reviews placeholder */}
                <div className="space-y-3">
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

            {/* Bottom CTA */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-background border-t border-border/40 px-5 pt-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Total</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    R$ {finalPrice.toFixed(2)}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={outOfStock}
                  className={cn(
                    "px-8 py-3 rounded-xl text-sm font-semibold transition-all",
                    outOfStock
                      ? "bg-muted text-muted-foreground"
                      : "bg-foreground text-background active:scale-[0.97]"
                  )}
                >
                  {outOfStock ? "Indisponível" : "Comprar"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
