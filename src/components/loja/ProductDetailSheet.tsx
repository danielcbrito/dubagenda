import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Package, Star, Minus, Plus, ThumbsUp } from "lucide-react";
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

const FAKE_REVIEWS = [
  {
    name: "Carlos M.",
    rating: 5,
    date: "há 3 dias",
    comment: "Produto excelente! Qualidade surpreendente, superou minhas expectativas. Recomendo demais!",
    helpful: 14,
    images: [
      "https://images.unsplash.com/photo-1585747860036-4cb2154c4970?w=120&h=120&fit=crop",
      "https://images.unsplash.com/photo-1626015365107-aa76da6e04c4?w=120&h=120&fit=crop",
    ],
  },
  {
    name: "Rafael S.",
    rating: 5,
    date: "há 1 semana",
    comment: "Muito bom! Chegou bem embalado e o produto é de primeira. Voltarei a comprar com certeza.",
    helpful: 23,
    images: [
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=120&h=120&fit=crop",
    ],
  },
  {
    name: "Lucas P.",
    rating: 4,
    date: "há 2 semanas",
    comment: "Produto muito bom, bem confortável. Único detalhe é que demorou um pouco pra chegar, mas valeu a espera.",
    helpful: 8,
    images: [],
  },
];

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
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2000);
      toast.success("Produto adicionado ao carrinho", {
        description: `${qty}x ${produto.nome}`,
        action: {
          label: "Ver carrinho",
          onClick: () => {
            onClose();
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
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("open-cart"));
      }, 350);
      toast.success("Produto pronto para finalizar!", {
        description: `${qty}x ${produto.nome}`,
      });
    }
  };

  const avgRating = 4.7;
  const totalReviews = FAKE_REVIEWS.length;

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
          {/* Back button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setQty(1); onClose(); }}
            className="absolute top-4 left-4 z-10 w-9 h-9 flex items-center justify-center cursor-pointer rounded-full bg-background/60 backdrop-blur-md shadow-md"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-8">
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

              {/* Action buttons — inline, above description */}
              {!outOfStock && (
                <div className="flex flex-col gap-2.5 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleBuyNow}
                    className="w-full py-4 rounded-xl text-[15px] font-bold bg-foreground text-background active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Comprar Agora
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAddToCart}
                    className={cn(
                      "w-full py-4 rounded-xl text-[15px] font-bold transition-all cursor-pointer",
                      addedFeedback
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-card border border-border/50 text-foreground active:scale-[0.98]"
                    )}
                  >
                    {addedFeedback ? "Adicionado!" : "Adicionar ao Carrinho"}
                  </motion.button>
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

              {/* Reviews section — Shopee style */}
              <div className="space-y-4 pb-6">
                {/* Review header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-foreground tabular-nums">{avgRating}</span>
                    <Star className="w-5 h-5 text-amber-400" fill="currentColor" />
                    <span className="text-sm text-muted-foreground">
                      Avaliações ({totalReviews})
                    </span>
                  </div>
                  <span className="text-xs text-primary font-medium cursor-pointer">Ver mais</span>
                </div>

                {/* Highlight badge */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <span className="text-amber-500 text-xs">💬</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Frequentemente avaliado como produto excelente
                  </span>
                </div>

                {/* Individual reviews */}
                <div className="space-y-5">
                  {FAKE_REVIEWS.map((review, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="space-y-2.5"
                    >
                      {/* Review header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {review.name.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-foreground">{review.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
                          <ThumbsUp className="w-3 h-3" />
                          <span>Útil ({review.helpful})</span>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={cn(
                              "w-3.5 h-3.5",
                              s <= review.rating ? "text-amber-400" : "text-muted-foreground/15"
                            )}
                            fill="currentColor"
                          />
                        ))}
                        <span className="text-[10px] text-muted-foreground/40 ml-2">
                          {review.date}
                        </span>
                      </div>

                      {/* Comment */}
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {review.comment}
                      </p>

                      {/* Review images */}
                      {review.images.length > 0 && (
                        <div className="flex gap-2">
                          {review.images.map((img, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="w-20 h-20 rounded-lg overflow-hidden bg-muted/20"
                            >
                              <img
                                src={img}
                                alt={`Avaliação ${idx + 1} foto ${imgIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {idx < FAKE_REVIEWS.length - 1 && (
                        <div className="h-px bg-border/15 mt-3" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
