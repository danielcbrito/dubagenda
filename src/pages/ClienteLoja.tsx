import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ShoppingBag, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "@/components/BottomNavigation";
import { ProductDetailSheet } from "@/components/loja/ProductDetailSheet";

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

export default function ClienteLoja() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);

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

  const categories = useMemo(() => {
    const cats = [...new Set(produtos.map((p) => p.categoria))];
    return cats.sort();
  }, [produtos]);

  const filtered = useMemo(() => {
    let result = produtos;
    if (selectedCategory) {
      result = result.filter((p) => p.categoria === selectedCategory);
    }
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

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ─── Header ─── */}
      <div className="flex-shrink-0">
        {/* Top bar */}
        <div className="px-4 pt-4 pb-2" />

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Buscar na loja"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full h-11 pl-10 pr-4 rounded-full",
                "bg-card border border-border/60",
                "text-sm text-foreground placeholder:text-muted-foreground/40",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
                "transition-all duration-200"
              )}
            />
          </div>
        </div>

        {/* Categories — pill style */}
        {categories.length > 0 && (
          <div className="px-4 pb-3">
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

        {/* Subtle divider */}
        <div className="h-px bg-border/40" />
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-3 z-10 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, hsl(var(--background)), transparent)",
          }}
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
          ) : filtered.length === 0 ? (
            <EmptyState
              title={searchQuery ? "Nenhum resultado" : "Nenhum produto disponível"}
              description={
                searchQuery
                  ? "Tente buscar por outro termo."
                  : "A barbearia ainda não cadastrou produtos."
              }
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
                    <ProductCard key={produto.id} produto={produto} index={i} discount={discountPercent(produto)} onClick={() => setSelectedProduct(produto)} />
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
      />

      {!selectedProduct && (
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

/* ─── Featured Card (horizontal scroll) ─── */
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

/* ─── Product Card (grid) ─── */
function ProductCard({ produto, index, discount, onClick }: { produto: Produto; index: number; discount: number; onClick: () => void }) {
  const hasPromo = discount > 0;
  const outOfStock = produto.estoque <= 0;

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
