import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BusinessHoursConfig {
  aberto: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  hora_almoco_inicio: string | null;
  hora_almoco_fim: string | null;
  delay_entre_servicos: number;
}

/**
 * Hook para carregar horário de funcionamento com hierarquia de prioridade:
 * 1) Exceção do barbeiro (horarios_excepcionais_barbeiro)
 * 2) Exceção global (horarios_excepcionais)
 * 3) Config padrão do barbeiro (configuracoes_horario_barbeiro)
 * 4) Config da unidade/loja (configuracoes_horario_unidade)
 * 5) Config padrão global legada (configuracoes_horario)
 */
export function useBarberBusinessHours(date: Date, barbeiroId: string | null) {
  const [config, setConfig] = useState<BusinessHoursConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("padrão global");

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();
      let tenantId: string | null = null;
      let unidadeId: string | null = null;

      if (barbeiroId) {
        const { data: barberScope } = await supabase
          .from("barbeiros")
          .select("tenant_id, unidade_id")
          .eq("id", barbeiroId)
          .maybeSingle();
        tenantId = barberScope?.tenant_id ?? null;
        unidadeId = (barberScope as any)?.unidade_id ?? null;
      }

      let sourceData: any = null;
      let configSource = "padrão global";
      let barberConfigExplicit = false;

      // 1) Exceção do barbeiro
      if (barbeiroId) {
        const { data } = await supabase
          .from("horarios_excepcionais_barbeiro")
          .select("*")
          .eq("barbeiro_id", barbeiroId)
          .eq("data", dateStr)
          .maybeSingle();
        if (data) { sourceData = data; configSource = "EXCEÇÃO BARBEIRO"; barberConfigExplicit = true; }
      }

      // 2) Exceção global
      if (!sourceData) {
        let globalExceptionQuery = supabase
          .from("horarios_excepcionais")
          .select("*")
          .eq("data", dateStr);
        if (tenantId) globalExceptionQuery = globalExceptionQuery.eq("tenant_id", tenantId);
        const { data } = await globalExceptionQuery.maybeSingle();
        if (data) { sourceData = data; configSource = "EXCEÇÃO GLOBAL"; }
      }

      // 3) Config padrão do barbeiro
      let barberDayConfig: any = null;
      if (barbeiroId) {
        const { data } = await supabase
          .from("configuracoes_horario_barbeiro")
          .select("*")
          .eq("barbeiro_id", barbeiroId)
          .eq("dia_semana", dayOfWeek)
          .maybeSingle();
        barberDayConfig = data;
      }

      // 4) Config da unidade (loja)
      const loadUnidadeConfig = async () => {
        if (unidadeId) {
          const { data } = await supabase
            .from("configuracoes_horario_unidade")
            .select("*")
            .eq("unidade_id", unidadeId)
            .eq("dia_semana", dayOfWeek)
            .maybeSingle();
          if (data) return data;
        }
        if (tenantId) {
          const { data } = await supabase
            .from("configuracoes_horario_unidade")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("dia_semana", dayOfWeek)
            .order("unidade_id", { nullsFirst: false })
            .limit(1)
            .maybeSingle();
          if (data) return data;
        }
        return null;
      };

      const unidadeConfig = await loadUnidadeConfig();

      if (!sourceData) {
        if (unidadeConfig && unidadeConfig.aberto === false) {
          sourceData = unidadeConfig;
          configSource = "CONFIG UNIDADE (FECHADA)";
        } else if (barberDayConfig && unidadeConfig) {
          const barberUpdated = barberDayConfig.updated_at ? new Date(barberDayConfig.updated_at).getTime() : 0;
          const unitUpdated = unidadeConfig.updated_at ? new Date(unidadeConfig.updated_at).getTime() : 0;

          if (unitUpdated > barberUpdated) {
            sourceData = unidadeConfig;
            configSource = "CONFIG UNIDADE (mais recente)";
          } else {
            sourceData = barberDayConfig;
            configSource = "CONFIG BARBEIRO (mais recente)";
            barberConfigExplicit = true;
          }
        } else if (barberDayConfig && barberDayConfig.aberto !== null) {
          sourceData = barberDayConfig;
          configSource = "CONFIG BARBEIRO";
          barberConfigExplicit = true;
        } else if (unidadeConfig) {
          sourceData = unidadeConfig;
          configSource = "CONFIG UNIDADE";
        }
      }

      // 5) Config global legada
      if (!sourceData) {
        const { data } = await supabase
          .from("configuracoes_horario")
          .select("*")
          .eq("dia_semana", dayOfWeek)
          .maybeSingle();
        if (data) { sourceData = data; configSource = "CONFIG GLOBAL"; }
      }

      const result: BusinessHoursConfig = sourceData ? {
        aberto: sourceData.aberto ?? true,
        hora_abertura: sourceData.hora_abertura || "09:00",
        hora_fechamento: sourceData.hora_fechamento || "21:00",
        hora_almoco_inicio: sourceData.hora_almoco_inicio,
        hora_almoco_fim: sourceData.hora_almoco_fim,
        delay_entre_servicos: sourceData.delay_entre_servicos || 10,
      } : {
        aberto: dayOfWeek !== 0,
        hora_abertura: "09:00",
        hora_fechamento: "21:00",
        hora_almoco_inicio: "13:00",
        hora_almoco_fim: "14:00",
        delay_entre_servicos: 10,
      };

      // ISOLAMENTO DE EXPEDIENTE: se a loja estiver fechada naquele dia, permanece fechado
      if (barbeiroId && configSource !== "CONFIG GLOBAL" && configSource !== "CONFIG UNIDADE" && configSource !== "padrão global") {
        let storeData: any = unidadeConfig;
        if (!storeData) {
          const { data: globalData } = await supabase
            .from("configuracoes_horario")
            .select("*")
            .eq("dia_semana", dayOfWeek)
            .maybeSingle();
          storeData = globalData;
        }

        if (storeData && storeData.aberto === false) {
          result.aberto = false;
        }
      }

      console.log(`[useBarberBusinessHours] Dia ${dayOfWeek} (${configSource}): ${result.hora_abertura}-${result.hora_fechamento}`);
      setConfig(result);
      setSource(configSource);
      setLoading(false);
    };

    fetchConfig();

    const channel = supabase
      .channel(`barber-hours-rt-${barbeiroId || 'all'}-${date.toISOString().slice(0, 10)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_horario_unidade',
        },
        () => {
          console.log('[useBarberBusinessHours] Realtime update on configuracoes_horario_unidade');
          fetchConfig();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_horario_barbeiro',
        },
        () => {
          console.log('[useBarberBusinessHours] Realtime update on configuracoes_horario_barbeiro');
          fetchConfig();
        }
      )
      .subscribe();

    const handleFocus = () => {
      fetchConfig();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchConfig();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [date, barbeiroId]);

  return { config, loading, source };
}

