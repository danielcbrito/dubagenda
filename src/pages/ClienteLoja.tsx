import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, ShoppingBag, Search, Tag, Star, 
  Sparkles, Package, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "@/components/BottomNavigation";

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
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [plansSheetOpen, setPlansSheetOpen] = useState(false);

  // Get user's preferred barbershop
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

  // Fetch products
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

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(produtos.map((p) => p.categoria))];
    return cats.sort();
  }, [produtos]);

  // Filtered products
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

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-3">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/cliente")}
            className="w-8 h-8 rounded-xl bg-card flex items-center justify-center border border-border/50"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Loja
            </h1>
            {userTenant && (
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                {userTenant.nome}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                !selectedCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/50"
              )}
            >
              Todos
            </motion.button>
            {categories.map((cat) => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                  cat === selectedCategory
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/50"
                )}
              >
                {categoryLabels[cat] || cat}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, hsl(var(--background)), transparent)",
          }}
        />
        <div className="h-full overflow-y-auto overscroll-contain pb-24 px-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Carregando produtos...</span>
            </div>
          ) : !userTenant ? (
            <EmptyState
              icon={<ShoppingBag className="w-10 h-10 text-muted-foreground/30" />}
              title="Selecione uma barbearia"
              description="Escolha sua barbearia preferida para ver os produtos disponíveis."
              action={
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/cliente/barbearia")}
                  className="mt-3 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
                >
                  Escolher Barbearia
                </motion.button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="w-10 h-10 text-muted-foreground/30" />}
              title={searchQuery ? "Nenhum resultado" : "Nenhum produto disponível"}
              description={
                searchQuery
                  ? "Tente buscar por outro termo."
                  : "A barbearia ainda não cadastrou produtos. Volte em breve!"
              }
            />
          ) : (
            <div className="space-y-5 pt-2">
              {/* Featured section */}
              {!selectedCategory && !searchQuery && featured.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      Destaques
                    </span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                    {featured.map((produto, i) => (
                      <FeaturedProductCard key={produto.id} produto={produto} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* All products grid */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {selectedCategory
                      ? categoryLabels[selectedCategory] || selectedCategory
                      : "Todos os produtos"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 tabular-nums ml-auto">
                    {filtered.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {filtered.map((produto, i) => (
                    <ProductCard key={produto.id} produto={produto} index={i} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation
        onProfileClick={() => navigate("/cliente/perfil")}
        onPlansClick={() => navigate("/cliente/assinar")}
      />
    </div>
  );
}

/* ─── Featured Product Card ─── */
function FeaturedProductCard({ produto, index }: { produto: Produto; index: number }) {
  const hasPromo = produto.preco_promocional && produto.preco_promocional < produto.preco;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex-shrink-0 w-[200px] rounded-xl border border-border/50 bg-card overflow-hidden active:scale-[0.98] transition-transform"
    >
      {/* Image */}
      <div className="relative h-28 bg-muted/30 flex items-center justify-center overflow-hidden">
        {produto.imagem_url ? (
          <img
            src={produto.imagem_url}
            alt={produto.nome}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <ShoppingBag className="w-8 h-8 text-muted-foreground/20" />
        )}
        {hasPromo && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-md uppercase tracking-wide">
            Oferta
          </div>
        )}
        {produto.destaque && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-secondary/90 text-secondary-foreground text-[9px] font-bold rounded-md flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5" />
            Destaque
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold text-foreground line-clamp-1">{produto.nome}</h3>
        {produto.descricao && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {produto.descricao}
          </p>
        )}
        <div className="flex items-baseline gap-1.5 pt-1">
          {hasPromo ? (
            <>
              <span className="text-sm font-bold text-primary tabular-nums">
                R$ {produto.preco_promocional!.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground line-through tabular-nums">
                R$ {produto.preco.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-foreground tabular-nums">
              R$ {produto.preco.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Product Card ─── */
function ProductCard({ produto, index }: { produto: Produto; index: number }) {
  const hasPromo = produto.preco_promocional && produto.preco_promocional < produto.preco;
  const outOfStock = produto.estoque <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-xl border border-border/50 bg-card overflow-hidden active:scale-[0.98] transition-transform",
        outOfStock && "opacity-50"
      )}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
        {produto.imagem_url ? (
          <img
            src={produto.imagem_url}
            alt={produto.nome}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <ShoppingBag className="w-8 h-8 text-muted-foreground/15" />
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Esgotado
            </span>
          </div>
        )}
        {hasPromo && !outOfStock && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-md uppercase">
            Oferta
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-2.5 space-y-0.5">
        <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
          {produto.nome}
        </h3>
        <div className="flex items-baseline gap-1.5 pt-0.5">
          {hasPromo ? (
            <>
              <span className="text-[13px] font-bold text-primary tabular-nums">
                R$ {produto.preco_promocional!.toFixed(2)}
              </span>
              <span className="text-[9px] text-muted-foreground line-through tabular-nums">
                R$ {produto.preco.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-[13px] font-bold text-foreground tabular-nums">
              R$ {produto.preco.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Empty State ─── */
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center gap-3"
    >
      {icon}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-[240px]">{description}</p>
      {action}
    </motion.div>
  );
}
