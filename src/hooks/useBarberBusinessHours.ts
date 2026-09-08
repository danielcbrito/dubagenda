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
      if (!sourceData && barbeiroId) {
        const { data } = await supabase
          .from("configuracoes_horario_barbeiro")
          .select("*")
          .eq("barbeiro_id", barbeiroId)
          .eq("dia_semana", dayOfWeek)
          .maybeSingle();
        if (data && data.aberto !== null) { sourceData = data; configSource = "CONFIG BARBEIRO"; barberConfigExplicit = true; }
      }

      // 4) Config da unidade (loja)
      let unidadeConfig: any = null;
      if (unidadeId) {
        const { data } = await supabase
          .from("configuracoes_horario_unidade")
          .select("*")
          .eq("unidade_id", unidadeId)
          .eq("dia_semana", dayOfWeek)
          .maybeSingle();
        unidadeConfig = data ?? null;
      }
      if (!unidadeConfig && tenantId) {
        const { data } = await supabase
          .from("configuracoes_horario_unidade")
          .select("*")
          .eq("tenant_id", tenantId)
          .is("unidade_id", null)
          .eq("dia_semana", dayOfWeek)
          .maybeSingle();
        unidadeConfig = data ?? null;
      }
      if (!sourceData && unidadeConfig) { sourceData = unidadeConfig; configSource = "CONFIG UNIDADE"; }

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

      // CLAMP: a loja limita a janela do barbeiro (sem sobrescrever a decisão dele de atender)
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

        if (storeData) {
          if (storeData.aberto === false && !barberConfigExplicit) {
            result.aberto = false;
          } else if (storeData.aberto !== false) {
            const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            const gOpen = toMin(storeData.hora_abertura || "09:00");
            const gClose = toMin(storeData.hora_fechamento || "21:00");
            const bOpen = toMin(result.hora_abertura);
            const bClose = toMin(result.hora_fechamento);
            if (bOpen < gOpen) result.hora_abertura = (storeData.hora_abertura || "09:00").substring(0, 5);
            if (bClose > gClose) result.hora_fechamento = (storeData.hora_fechamento || "21:00").substring(0, 5);
          }
        }
      }

      console.log(`[useBarberBusinessHours] Dia ${dayOfWeek} (${configSource}): ${result.hora_abertura}-${result.hora_fechamento}`);
      setConfig(result);
      setSource(configSource);
      setLoading(false);
    };

    fetchConfig();
  }, [date, barbeiroId]);

  return { config, loading, source };
}

