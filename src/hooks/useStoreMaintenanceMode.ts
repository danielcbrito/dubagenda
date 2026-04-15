import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInterval } from "@/hooks/useInterval";

interface StoreMaintenanceStatus {
  loja_manutencao_ativa: boolean;
  loja_manutencao_mensagem: string | null;
  loja_manutencao_inicio_programada: string | null;
  loja_manutencao_fim_programada: string | null;
}

const DEFAULT_STORE_MAINTENANCE_MESSAGE =
  "A loja está em manutenção no momento. Tente novamente mais tarde.";

export function useStoreMaintenanceMode() {
  const [isStoreMaintenanceMode, setIsStoreMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const processStoreMaintenanceData = useCallback((status: StoreMaintenanceStatus | null) => {
    if (!status) {
      setIsStoreMaintenanceMode(false);
      setMaintenanceMessage(null);
      return;
    }

    const now = new Date();
    const startDate = status.loja_manutencao_inicio_programada
      ? new Date(status.loja_manutencao_inicio_programada)
      : null;
    const endDate = status.loja_manutencao_fim_programada
      ? new Date(status.loja_manutencao_fim_programada)
      : null;

    let maintenanceActive = Boolean(status.loja_manutencao_ativa);

    if (startDate && endDate && now >= startDate && now <= endDate) {
      maintenanceActive = true;
    }

    setIsStoreMaintenanceMode(maintenanceActive);
    setMaintenanceMessage(status.loja_manutencao_mensagem || DEFAULT_STORE_MAINTENANCE_MESSAGE);
  }, []);

  const checkStoreMaintenanceStatus = useCallback(async () => {
    try {
      const { data: latestConfig, error: tableError } = await supabase
        .from("webhook_config")
        .select(
          "loja_manutencao_ativa, loja_manutencao_mensagem, loja_manutencao_inicio_programada, loja_manutencao_fim_programada"
        )
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tableError && latestConfig) {
        processStoreMaintenanceData(latestConfig as StoreMaintenanceStatus);
        return;
      }

      if (tableError) {
        console.warn(
          "[Store Maintenance] Could not read webhook_config directly; falling back to RPC:",
          tableError
        );
      }

      const { data, error } = await supabase.rpc("get_store_maintenance_config");

      if (error) {
        console.error("Error checking store maintenance status:", error);
        setIsStoreMaintenanceMode(false);
        setMaintenanceMessage(null);
        return;
      }

      const status = (Array.isArray(data) ? data[0] : data) as StoreMaintenanceStatus | null;
      processStoreMaintenanceData(status ?? null);
    } catch (error) {
      console.error("Error checking store maintenance status:", error);
      setIsStoreMaintenanceMode(false);
      setMaintenanceMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [processStoreMaintenanceData]);

  const pollingDelayMs = isLoading ? null : isStoreMaintenanceMode ? 2000 : 15000;

  useInterval(() => {
    void checkStoreMaintenanceStatus();
  }, pollingDelayMs);

  useEffect(() => {
    void checkStoreMaintenanceStatus();

    const channel = supabase
      .channel("store-maintenance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "webhook_config",
        },
        () => {
          void checkStoreMaintenanceStatus();
        }
      )
      .subscribe();

    const handleFocus = () => {
      void checkStoreMaintenanceStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkStoreMaintenanceStatus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [checkStoreMaintenanceStatus]);

  return {
    isStoreMaintenanceMode,
    maintenanceMessage,
    isLoading,
    refresh: checkStoreMaintenanceStatus,
  };
}
