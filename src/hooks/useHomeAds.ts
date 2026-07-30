import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import adPlansImage from "@/assets/ad-plans.jpg";

export type HomeAdKind = "plans" | "app";

export interface HomeAd {
  id: string;
  kind: HomeAdKind;
  /** Rótulo curto exibido no topo do slide (ex: "Patrocinado") */
  eyebrow: string;
  titulo: string;
  descricao?: string | null;
  ctaLabel: string;
  /** Rota interna ou URL externa */
  ctaTarget?: string | null;
  ctaTipo?: string | null;
  imageUrl?: string | null;
}

const CACHE_PREFIX = "home_ads_v4:";
const CACHE_TTL_MS = 5 * 60 * 1000;

function readCache(key: string): HomeAd[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.d as HomeAd[];
  } catch {
    return null;
  }
}

function writeCache(key: string, data: HomeAd[]) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    /* storage cheio — ignora */
  }
}

function resolveImage(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  try {
    return supabase.storage.from("anuncios").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

interface UseHomeAdsOptions {
  /** Esconde o anúncio de planos quando o cliente já é assinante */
  hasSubscription?: boolean;
  enabled?: boolean;
}

/**
 * Monta a fila de anúncios da home do cliente:
 * 1. Anúncio dinâmico de planos (apenas se a barbearia tiver planos ativos)
 * 2. Anúncios institucionais do app (tabela anuncios_app)
 */
export function useHomeAds(
  tenantId: string | null | undefined,
  { hasSubscription = false, enabled = true }: UseHomeAdsOptions = {},
) {
  const cacheKey = `${tenantId ?? "global"}:${hasSubscription ? "sub" : "free"}`;
  const [ads, setAds] = useState<HomeAd[]>(() => readCache(cacheKey) ?? []);

  const load = useCallback(async () => {
    const queue: HomeAd[] = [];

    // Filtros ANTES de order/limit (encadear .eq depois de .limit quebra o builder)
    let planosBase = supabase
      .from("planos")
      .select("id, nome, preco_mensal, limite_agendamentos_mes")
      .eq("ativo", true);

    planosBase = tenantId
      ? planosBase.eq("tenant_id", tenantId)
      : planosBase.is("tenant_id", null);

    const planosPromise = hasSubscription
      ? Promise.resolve({ data: [] as any[], error: null })
      : planosBase.order("preco_mensal", { ascending: true }).limit(1);

    const [planosRes, anunciosRes] = await Promise.all([
      planosPromise,
      supabase
        .from("anuncios_app")
        .select("id, titulo, descricao, imagem_path, cta_label, cta_target, cta_tipo, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
    ]);

    // Never let an optional institutional-ad failure discard a valid plan ad.
    // Keeping these errors visible also prevents another silent empty queue.
    if (planosRes.error) {
      console.error("[home-ads] Não foi possível carregar os planos", planosRes.error.message);
    }
    if (anunciosRes.error) {
      console.error("[home-ads] Não foi possível carregar anúncios institucionais", anunciosRes.error.message);
    }

    const plano = (planosRes.data || [])[0] as any;
    if (plano) {
      const preco = Number(plano.preco_mensal || 0);
      queue.push({
        id: `plan-${plano.id}`,
        kind: "plans",
        eyebrow: "Planos",
        titulo: "Conheça os planos",
        descricao:
          preco > 0
            ? `A partir de R$ ${preco.toFixed(2).replace(".", ",")} por mês${
                plano.limite_agendamentos_mes ? ` • ${plano.limite_agendamentos_mes} cortes` : ""
              }`
            : "Assine e economize nos seus cortes",
        ctaLabel: "Ver planos",
        ctaTarget: "/cliente/assinar",
        ctaTipo: "rota",
        imageUrl: adPlansImage,
      });
    }

    (anunciosRes.data || []).forEach((a: any) => {
      queue.push({
        id: `app-${a.id}`,
        kind: "app",
        eyebrow: "Patrocinado",
        titulo: a.titulo,
        descricao: a.descricao,
        ctaLabel: a.cta_label || "Saiba mais",
        ctaTarget: a.cta_target,
        ctaTipo: a.cta_tipo,
        imageUrl: resolveImage(a.imagem_path),
      });
    });

    setAds(queue);
    writeCache(cacheKey, queue);
  }, [tenantId, hasSubscription, cacheKey]);

  useEffect(() => {
    if (!enabled) return;
    const cached = readCache(cacheKey);
    if (cached) setAds(cached);
    load();
  }, [enabled, cacheKey, load]);

  return { ads };
}
