import { useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { SearchX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BackArrow } from "@/components/ui/back-arrow";
import { DiscoverUnitCard } from "@/components/discover/DiscoverUnitCard";

interface ShopData {
  id: string;
  nome: string;
  slug: string | null;
  logo_url: string | null;
  slogan: string | null;
}

interface UnitRow {
  id: string;
  nome: string;
  slug: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  rua: string | null;
  numero: string | null;
  is_sede: boolean | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

const BarbershopUnidades = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedCurrentUnitId = searchParams.get("current");

  const { data: shop } = useQuery({
    queryKey: ["shop-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, nome, slug, logo_url, slogan")
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data as ShopData;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });

  const { data: currentUnitId } = useQuery({
    queryKey: ["current-unit-for-unidades-page", shop?.id, requestedCurrentUnitId],
    queryFn: async () => {
      if (!shop?.id) return null;

      if (requestedCurrentUnitId) {
        const { data, error } = await supabase
          .from("tenant_unidades")
          .select("id")
          .eq("tenant_id", shop.id)
          .eq("id", requestedCurrentUnitId)
          .maybeSingle();

        if (error) throw error;
        if (data?.id) return data.id;
      }

      const { data, error } = await supabase
        .from("tenant_unidades")
        .select("id")
        .eq("tenant_id", shop.id)
        .eq("is_sede", true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!shop?.id,
    staleTime: 5 * 60 * 1000,
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
      return (data ?? []) as UnitRow[];
    },
    enabled: !!shop?.id,
    staleTime: 5 * 60 * 1000,
  });

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

  const displayUnits = useMemo(
    () =>
      unidades
        .filter((unit) => unit.id !== currentUnitId)
        .map((unit) => ({
          id: unit.id,
          nome: unit.nome,
          brandName: shop?.nome ?? unit.nome,
          brandLogo: unit.logo_url || shop?.logo_url || null,
          brandSlug: shop?.slug ?? null,
          bannerUrl: bannerUrl ?? null,
          bairro: unit.bairro,
          cidade: unit.cidade,
          rua: unit.rua,
          numero: unit.numero,
          travelMinutes: null,
          travelMode: null as "walking" | "driving" | null,
          is_sede: unit.is_sede ?? false,
        })),
    [bannerUrl, currentUnitId, shop?.logo_url, shop?.nome, shop?.slug, unidades]
  );

  const handleCardClick = (unitId: string) => {
    navigate(`/b/${shop?.slug ?? slug}?unidade=${unitId}`);
  };

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
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
            {!isLoading && (
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/35">
                {displayUnits.length} {displayUnits.length === 1 ? "outra unidade" : "outras unidades"}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 z-10 h-4"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-4 pb-24">
          {isLoading ? (
            <div className="space-y-4 pt-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-border/40">
                  <Skeleton className="h-28 w-full rounded-none" />
                  <div className="space-y-2 p-3.5">
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
              <SearchX className="mb-3 h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhuma outra unidade encontrada</p>
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
