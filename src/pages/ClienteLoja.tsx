import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, ShoppingCart, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "@/components/BottomNavigation";
import { ProductDetailSheet } from "@/components/loja/ProductDetailSheet";
import { CartSheet } from "@/components/loja/CartSheet";
import { CheckoutSheet } from "@/components/loja/CheckoutSheet";
import { useCart } from "@/hooks/useCart";
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

interface TenantInfo {
  id: string;
  nome: string;
}

interface BannerSlide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle?: string;
}

export default function ClienteLoja() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSelectedIds, setCheckoutSelectedIds] = useState<Set<string>>(new Set());
  const [currentSlide, setCurrentSlide] = useState(0);
  const cart = useCart();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const slideIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: userTenant } = useQuery({
    queryKey: ["user-tenant-loja"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("barbearia_preferida_id")
        .eq("id", user.id)
        .single();
      if (!profile?.barbearia_preferida_id) return null;
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, nome")
        .eq("id", profile.barbearia_preferida_id)
        .single();
      return tenant as TenantInfo | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: bannerUrl } = useQuery({
    queryKey: ["tenant-banner-loja", userTenant?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_tenant_banners", {
        p_tenant_ids: [userTenant!.id],
      });
      const banners = data as { tenant_id: string; banner_url: string }[] | null;
      return banners?.[0]?.banner_url ?? null;
    },
    enabled: !!userTenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-loja", userTenant?.id],
    queryFn: async () => {
      if (!userTenant?.id) return [];
      const { data, error } = await supabase
        .from("produtos_loja")
        .select("*")
        .eq("tenant_id", userTenant.id)
        .eq("ativo", true)
        .order("destaque", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Produto[];
    },
    enabled: !!userTenant?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Build carousel slides from banner + featured products with promos
  const bannerSlides = useMemo<BannerSlide[]>(() => {
    const slides: BannerSlide[] = [];
    if (bannerUrl) {
      slides.push({
        id: "main-banner",
        imageUrl: bannerUrl,
        title: userTenant?.nome || "Loja",
        subtitle: "Aproveite descontos exclusivos",
      });
    }
    // Add featured products with images as promo slides
    const promoProducts = produtos.filter(
      (p) => p.destaque && p.imagem_url && p.preco_promocional && p.preco_promocional < p.preco
    );
    promoProducts.slice(0, 4).forEach((p) => {
      const disc = Math.round(((p.preco - p.preco_promocional!) / p.preco) * 100);
      slides.push({
        id: `promo-${p.id}`,
        imageUrl: p.imagem_url!,
        title: p.nome,
        subtitle: `${disc}% OFF — R$ ${p.preco_promocional!.toFixed(2)}`,
      });
    });
    // Fallback if no slides
    if (slides.length === 0) {
      slides.push({
        id: "default",
        imageUrl: "",
        title: userTenant?.nome || "Loja DUB",
        subtitle: "Confira nossos produtos",
      });
    }
    return slides;
  }, [bannerUrl, produtos, userTenant]);

  // Auto-rotate carousel
  useEffect(() => {
    if (bannerSlides.length <= 1) return;
    slideIntervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
    }, 4000);
    return () => {
      if (slideIntervalRef.current) clearInterval(slideIntervalRef.current);
    };
  }, [bannerSlides.length]);

  const goToSlide = useCallback((i: number) => {
    setCurrentSlide(i);
    if (slideIntervalRef.current) clearInterval(slideIntervalRef.current);
    slideIntervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
    }, 4000);
  }, [bannerSlides.length]);

  const categories = useMemo(() => {
    const cats = [...new Set(produtos.map((p) => p.categoria))];
    return cats.sort();
  }, [produtos]);

  const filtered = useMemo(() => {
    let result = produtos;
    if (selectedCategory) result = result.filter((p) => p.categoria === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nome.toLowerCase().includes(q) ||
          p.descricao?.toLowerCase().includes(q) ||
          p.categoria.toLowerCase().includes(q)
      );
    }
    return result;
  }, [produtos, selectedCategory, searchQuery]);

  const featured = useMemo(() => produtos.filter((p) => p.destaque), [produtos]);

  const categoryLabels: Record<string, string> = {
    cabelo: "Cabelo",
    barba: "Barba",
    skincare: "Skincare",
    acessorios: "Acessórios",
    geral: "Geral",
  };

  const discountPercent = (p: Produto) => {
    if (!p.preco_promocional || p.preco_promocional >= p.preco) return 0;
    return Math.round(((p.preco - p.preco_promocional) / p.preco) * 100);
  };

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Listen for "open-cart" event from ProductDetailSheet buy-now flow
  useEffect(() => {
    const handler = () => setCartOpen(true);
    document.addEventListener("open-cart", handler);
    return () => document.removeEventListener("open-cart", handler);
  }, []);

  const handleQuickAdd = useCallback((e: React.MouseEvent, produto: Produto) => {
    e.stopPropagation();
    cart.addItem(produto);
    toast.success("Produto adicionado ao carrinho", {
      description: produto.nome,
    });
  }, [cart]);

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ─── Search Overlay ─── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className="w-8 h-8 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 text-foreground" />
              </motion.button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full h-10 pl-9 pr-4 rounded-full",
                    "bg-card border border-border/50",
                    "text-sm text-foreground placeholder:text-muted-foreground/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20"
                  )}
                />
              </div>
            </div>
            <div className="h-px bg-border/30" />
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-8">
              {searchQuery.trim() === "" ? (
                <p className="text-xs text-muted-foreground/50 text-center pt-16">
                  Digite para buscar produtos
                </p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center pt-16 gap-2">
                  <Search className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-foreground">Nenhum resultado</p>
                  <p className="text-xs text-muted-foreground/50">Tente outro termo</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((produto) => {
                    const unitPrice = produto.preco_promocional != null && produto.preco_promocional < produto.preco
                      ? produto.preco_promocional
                      : produto.preco;
                    return (
                      <motion.div
                        key={produto.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => { setSelectedProduct(produto); setSearchOpen(false); }}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer active:bg-muted/20 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-lg bg-muted/15 overflow-hidden flex-shrink-0 border border-border/20">
                          {produto.imagem_url ? (
                            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground/10" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground line-clamp-1">{produto.nome}</p>
                          <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                            R$ {unitPrice.toFixed(2)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Top Bar ─── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-3">
        <p className="text-sm font-bold text-foreground truncate flex-1 mr-3">
          {userTenant?.nome || "Loja"}
        </p>
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setSearchOpen(true)}
            className="flex items-center justify-center cursor-pointer"
          >
            <Search className="w-[20px] h-[20px] text-foreground" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCartOpen(true)}
            className="relative flex items-center justify-center cursor-pointer"
          >
            <ShoppingCart className="w-[20px] h-[20px] text-foreground" />
            {cart.totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {cart.totalItems > 9 ? "9+" : cart.totalItems}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      {/* ─── Banner Carousel ─── */}
      <div className="flex-shrink-0 px-4 pb-3 pt-1">
        <div className="relative rounded-2xl overflow-hidden bg-muted/20" style={{ aspectRatio: "16/9" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={bannerSlides[currentSlide]?.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              {bannerSlides[currentSlide]?.imageUrl ? (
                <img
                  src={bannerSlides[currentSlide].imageUrl}
                  alt={bannerSlides[currentSlide].title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
              )}
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
              {/* Text */}
              <div className="absolute bottom-3 left-3.5 right-3.5">
                <p className="text-xs font-bold text-foreground line-clamp-1 drop-shadow-sm">
                  {bannerSlides[currentSlide]?.title}
                </p>
                {bannerSlides[currentSlide]?.subtitle && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                    {bannerSlides[currentSlide].subtitle}
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          {bannerSlides.length > 1 && (
            <div className="absolute bottom-3 right-3.5 flex gap-1">
              {bannerSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                    i === currentSlide
                      ? "bg-foreground w-4"
                      : "bg-foreground/30"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Categories ─── */}
      {categories.length > 0 && (
        <div className="flex-shrink-0 px-4 pt-1 pb-2.5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <CategoryPill
              label="Todos"
              active={!selectedCategory}
              onClick={() => setSelectedCategory(null)}
            />
            {categories.map((cat) => (
              <CategoryPill
                key={cat}
                label={categoryLabels[cat] || cat}
                active={cat === selectedCategory}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-border/20 flex-shrink-0" />

      {/* ─── Content ─── */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-3 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />
        <div className="h-full overflow-y-auto overscroll-contain pb-24">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Carregando...</span>
            </div>
          ) : !userTenant ? (
            <EmptyState
              title="Selecione uma barbearia"
              description="Escolha sua barbearia preferida para ver os produtos disponíveis."
              action={
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/cliente/barbearia")}
                  className="mt-3 px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
                >
                  Escolher Barbearia
                </motion.button>
              }
            />
          ) : filtered.length === 0 && !searchQuery ? (
            <EmptyState
              title="Nenhum produto disponível"
              description="A barbearia ainda não cadastrou produtos."
            />
          ) : filtered.length === 0 && searchQuery ? (
            <EmptyState
              title="Nenhum resultado"
              description="Tente buscar por outro termo."
            />
          ) : (
            <div className="px-4 pt-3 space-y-5">
              {/* Featured horizontal */}
              {!selectedCategory && !searchQuery && featured.length > 0 && (
                <section>
                  <SectionLabel text="Destaques" />
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                    {featured.map((produto, i) => (
                      <FeaturedCard key={produto.id} produto={produto} index={i} discount={discountPercent(produto)} onClick={() => setSelectedProduct(produto)} />
                    ))}
                  </div>
                </section>
              )}

              {/* Products grid */}
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <SectionLabel
                    text={
                      selectedCategory
                        ? categoryLabels[selectedCategory] || selectedCategory
                        : "Todos os produtos"
                    }
                  />
                  <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                    {filtered.length} {filtered.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {filtered.map((produto, i) => (
                    <ProductCard key={produto.id} produto={produto} index={i} discount={discountPercent(produto)} onClick={() => setSelectedProduct(produto)} onQuickAdd={(e) => handleQuickAdd(e, produto)} />
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <ProductDetailSheet
        produto={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(p) => cart.addItem(p)}
        allProducts={produtos}
        onSelectProduct={(p) => setSelectedProduct(p)}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        totalPrice={cart.totalPrice}
        onUpdateQuantity={cart.updateQuantity}
        onRemoveItem={cart.removeItem}
        onCheckout={(ids) => {
          setCheckoutSelectedIds(ids);
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart.items}
        selectedIds={checkoutSelectedIds}
        onOrderPlaced={() => {
          cart.clearCart();
          setCheckoutOpen(false);
        }}
        tenantId={userTenant?.id || ""}
        tenantNome={userTenant?.nome || "Loja"}
      />

      {!selectedProduct && !cartOpen && !searchOpen && (
        <BottomNavigation
          onProfileClick={() => navigate("/cliente/perfil")}
          onPlansClick={() => navigate("/cliente/assinar")}
        />
      )}
    </div>
  );
}

/* ─── Category Pill ─── */
function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200",
        active
          ? "bg-foreground text-background"
          : "bg-card text-muted-foreground border border-border/50 hover:border-border"
      )}
    >
      {label}
    </motion.button>
  );
}

/* ─── Section Label ─── */
function SectionLabel({ text }: { text: string }) {
  return (
    <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2.5">
      {text}
    </h2>
  );
}

/* ─── Featured Card ─── */
function FeaturedCard({ produto, index, discount, onClick }: { produto: Produto; index: number; discount: number; onClick: () => void }) {
  const hasPromo = discount > 0;
  const outOfStock = produto.estoque <= 0;

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "flex-shrink-0 w-[180px] rounded-2xl overflow-hidden cursor-pointer",
        "bg-card border border-border/30",
        "active:scale-[0.97] transition-transform duration-150",
        outOfStock && "opacity-50"
      )}
    >
      <div className="relative aspect-[4/3] bg-muted/20 overflow-hidden">
        {produto.imagem_url ? (
          <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground/10" />
          </div>
        )}
        {hasPromo && !outOfStock && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
            -{discount}%
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Esgotado</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{produto.nome}</p>
        <PriceDisplay produto={produto} hasPromo={hasPromo} size="sm" />
      </div>
    </motion.div>
  );
}

/* ─── Product Card ─── */
function ProductCard({ produto, index, discount, onClick, onQuickAdd }: { produto: Produto; index: number; discount: number; onClick: () => void; onQuickAdd?: (e: React.MouseEvent) => void }) {
  const hasPromo = discount > 0;
  const outOfStock = produto.estoque <= 0;
  const finalPrice = hasPromo ? produto.preco_promocional! : produto.preco;

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-2xl overflow-hidden cursor-pointer",
        "bg-card border border-border/30",
        "active:scale-[0.97] transition-transform duration-150",
        outOfStock && "opacity-50"
      )}
    >
      <div className="relative aspect-square bg-muted/20 overflow-hidden">
        {produto.imagem_url ? (
          <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground/10" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Esgotado</span>
          </div>
        )}
        {hasPromo && !outOfStock && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
            -{discount}%
          </div>
        )}
        {/* Quick add button */}
        {!outOfStock && onQuickAdd && (
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={onQuickAdd}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg cursor-pointer active:scale-90 transition-transform"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug min-h-[2rem]">
          {produto.nome}
        </p>
        <PriceDisplay produto={produto} hasPromo={hasPromo} size="md" />
      </div>
    </motion.div>
  );
}

/* ─── Price Display ─── */
function PriceDisplay({ produto, hasPromo, size }: { produto: Produto; hasPromo: boolean; size: "sm" | "md" }) {
  const mainSize = size === "md" ? "text-[15px]" : "text-[13px]";
  const oldSize = size === "md" ? "text-[10px]" : "text-[9px]";

  if (hasPromo) {
    return (
      <div className="space-y-0.5">
        <span className={cn(oldSize, "text-muted-foreground line-through tabular-nums block")}>
          R$ {produto.preco.toFixed(2)}
        </span>
        <span className={cn(mainSize, "font-bold text-primary tabular-nums")}>
          R$ {produto.preco_promocional!.toFixed(2)}
        </span>
      </div>
    );
  }

  return (
    <span className={cn(mainSize, "font-bold text-foreground tabular-nums")}>
      R$ {produto.preco.toFixed(2)}
    </span>
  );
}

/* ─── Empty State ─── */
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center gap-3 px-8"
    >
      <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center mb-1">
        <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
      </div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">{description}</p>
      {action}
    </motion.div>
  );
}
