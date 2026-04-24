import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlanServiceLink {
  id: string;
  nome: string;
  duracao_minutos?: number | null;
}

export interface PlanWithAvailability {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  limite_agendamentos_mes: number;
  tenant_id: string | null;
  ativo: boolean;
  controle_vagas_ativo: boolean;
  vagas: number | null;
  // computed
  vagas_ocupadas: number;
  vagas_restantes: number | null; // null quando controle_vagas_ativo === false
  esgotado: boolean;
  inativo: boolean;
  indisponivel: boolean; // esgotado || inativo
  servicos: PlanServiceLink[];
  servico_id_legacy: string | null;
}

// Status de assinatura que ocupam vaga (cancelled libera a vaga)
const STATUS_OCUPAM_VAGA = ["active", "trialing", "past_due"];

/**
 * Carrega planos de um tenant com cálculo dinâmico de vagas restantes,
 * lista de serviços vinculados (plano_servicos) e Realtime nas assinaturas.
 *
 * Mostra TODOS os planos (incluindo inativos) — a UI decide a aparência.
 */
export function usePlansAvailability(tenantId: string | null | undefined) {
  const [plans, setPlans] = useState<PlanWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Planos do tenant (inclui inativos para exibir como "Indisponível")
      let q = supabase.from("planos").select("*").order("preco_mensal");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      else q = q.is("tenant_id", null);
      const { data: planosData } = await q;
      const planos = planosData || [];

      if (planos.length === 0) {
        setPlans([]);
        return;
      }

      const planoIds = planos.map((p: any) => p.id);

      // 2) Vínculos plano_servicos + 3) Contagem de assinaturas ocupando vaga
      const [vinculosRes, assinaturasRes] = await Promise.all([
        supabase
          .from("plano_servicos" as any)
          .select("plano_id, servico_id, servicos:servicos(id, nome, duracao_minutos)")
          .in("plano_id", planoIds),
        supabase
          .from("assinaturas")
          .select("plano_id, status")
          .in("plano_id", planoIds)
          .in("status", STATUS_OCUPAM_VAGA as any),
      ]);

      const ocupadasPorPlano = new Map<string, number>();
      (assinaturasRes.data || []).forEach((row: any) => {
        ocupadasPorPlano.set(row.plano_id, (ocupadasPorPlano.get(row.plano_id) || 0) + 1);
      });

      const servicosPorPlano = new Map<string, PlanServiceLink[]>();
      (vinculosRes.data || []).forEach((row: any) => {
        const s = row.servicos;
        if (!s) return;
        const arr = servicosPorPlano.get(row.plano_id) || [];
        arr.push({ id: s.id, nome: s.nome, duracao_minutos: s.duracao_minutos });
        servicosPorPlano.set(row.plano_id, arr);
      });

      const enriched: PlanWithAvailability[] = planos.map((p: any) => {
        const ocupadas = ocupadasPorPlano.get(p.id) || 0;
        const controle = !!p.controle_vagas_ativo;
        const vagas = typeof p.vagas === "number" ? p.vagas : null;
        const restantes = controle && vagas !== null ? Math.max(0, vagas - ocupadas) : null;
        const esgotado = controle && vagas !== null && restantes === 0;
        const inativo = p.ativo === false;
        return {
          id: p.id,
          nome: p.nome,
          descricao: p.descricao || "",
          preco_mensal: Number(p.preco_mensal),
          beneficios_json: p.beneficios_json,
          limite_agendamentos_mes: p.limite_agendamentos_mes,
          tenant_id: p.tenant_id,
          ativo: p.ativo !== false,
          controle_vagas_ativo: controle,
          vagas,
          vagas_ocupadas: ocupadas,
          vagas_restantes: restantes,
          esgotado,
          inativo,
          indisponivel: inativo || esgotado,
          servicos: servicosPorPlano.get(p.id) || [],
          servico_id_legacy: p.servico_id || null,
        };
      });

      setPlans(enriched);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: re-carrega quando assinaturas ou planos mudam
  useEffect(() => {
    const planoIds = plans.map((p) => p.id);
    if (planoIds.length === 0) return;

    const channel = supabase
      .channel(`plan-vagas-${tenantId ?? "dub"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assinaturas" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planos" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plano_servicos" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // depende só de tenantId — load é estável via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, plans.length]);

  return { plans, loading, reload: load };
}
