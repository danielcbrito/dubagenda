import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, SearchX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BackArrow } from "@/components/ui/back-arrow";
import { DiscoverUnitCard } from "@/components/discover/DiscoverUnitCard";

const BarbershopUnidades = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUnitId = searchParams.get("current");

  const { data: shop } = useQuery({
    queryKey: ["shop-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, nome, slug, logo_url, slogan")
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });

  const { data: unidades = [], isLoading } = useQuery({
    queryKey: ["unidades-full", shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_unidades")
        .select("id, nome, slug, bairro, cidade, estado, rua, numero, is_sede, logo_url, latitude, longitude")
        .eq("tenant_id", shop!.id)
        .eq("ativo", true)
        .order("is_sede", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!shop?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch banner for the brand
  const { data: bannerUrl } = useQuery({
    queryKey: ["tenant-banner-unidades", shop?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_tenant_banners", {
        p_tenant_ids: [shop!.id],
      });
      const banners = data as { tenant_id: string; banner_url: string }[] | null;
      return banners?.[0]?.banner_url ?? null;
    },
    enabled: !!shop?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Filter out the current unit and map to DiscoverUnitCard format
  const displayUnits = unidades
    .filter((u) => u.id !== currentUnitId)
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      brandName: shop?.nome ?? u.nome,
      brandLogo: u.logo_url || shop?.logo_url || null,
      brandSlug: shop?.slug ?? null,
      bannerUrl: bannerUrl ?? null,
      bairro: u.bairro,
      cidade: u.cidade,
      rua: u.rua,
      numero: u.numero,
      travelMinutes: null,
      travelMode: null as "walking" | "driving" | null,
      is_sede: u.is_sede ?? false,
    }));

  const handleCardClick = (unitId: string) => {
    navigate(`/${shop?.slug ?? slug}?unidade=${unitId}&from=discover`);
  };

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/30 active:scale-90 transition-all text-foreground"
          >
            <BackArrow size={20} />
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-foreground leading-none tracking-tight font-['Space_Grotesk']">
              {shop?.nome ?? "Carregando..."}
            </h1>
            {!isLoading && displayUnits.length > 0 && (
              <p className="text-[10px] text-muted-foreground/35 mt-0.5 font-medium">
                {displayUnits.length} {displayUnits.length === 1 ? "outra unidade" : "outras unidades"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-4 pb-24">
          {isLoading ? (
            <div className="space-y-4 pt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border/40">
                  <Skeleton className="h-28 w-full rounded-none" />
                  <div className="p-3.5 space-y-2">
                    <Skeleton className="h-4 w-36 rounded-lg" />
                    <Skeleton className="h-3 w-48 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayUnits.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-16"
            >
              <SearchX className="w-8 h-8 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma outra unidade encontrada
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4 pt-1">
              {displayUnits.map((unit, index) => (
                <DiscoverUnitCard
                  key={unit.id}
                  unit={unit}
                  index={index}
                  isSelected={false}
                  onClick={() => handleCardClick(unit.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarbershopUnidades;
