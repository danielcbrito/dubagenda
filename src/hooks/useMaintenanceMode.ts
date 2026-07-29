import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useInterval } from '@/hooks/useInterval';

interface MaintenanceStatus {
  manutencao_ativa: boolean;
  manutencao_mensagem: string | null;
  manutencao_inicio_programada: string | null;
  manutencao_fim_programada: string | null;
  manutencao_aviso_ativo: boolean;
  manutencao_aviso_mensagem: string | null;
}

/**
 * Hook central de manutenção.
 *
 * Objetivo: garantir que o app saia (e entre) do modo manutenção de forma confiável.
 *
 * Estratégia:
 * - Tenta ler a configuração mais recente diretamente da tabela `webhook_config` (ordenada por updated_at)
 *   para evitar problemas quando existir mais de um registro.
 * - Se falhar (ex: RLS), faz fallback para a RPC `get_maintenance_status`.
 * - Mantém sincronizado via Realtime + polling de segurança (principalmente para destravar ao desativar).
 */
const MAINT_CACHE_KEY = 'dub_maintenance_cache_v1';

/** Lê o último status conhecido (síncrono) para não bloquear o primeiro paint. */
function readMaintenanceCache(): MaintenanceStatus | null {
  try {
    const raw = localStorage.getItem(MAINT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as MaintenanceStatus) : null;
  } catch {
    return null;
  }
}

export function useMaintenanceMode() {
  const cached = typeof window !== 'undefined' ? readMaintenanceCache() : null;
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(!!cached?.manutencao_ativa);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(cached?.manutencao_mensagem ?? null);
  // Se já temos um status em cache, o app renderiza imediatamente e revalida atrás.
  const [isLoading, setIsLoading] = useState(!cached);
  const [isAllowedUser, setIsAllowedUser] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [warningActive, setWarningActive] = useState(!!cached?.manutencao_aviso_ativo);
  const [warningMessage, setWarningMessage] = useState<string | null>(cached?.manutencao_aviso_mensagem ?? null);
  const [scheduledStart, setScheduledStart] = useState<Date | null>(null);
  const [scheduledEnd, setScheduledEnd] = useState<Date | null>(null);

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      // 1) Preferência: ler a configuração mais recente direto da tabela.
      // Isso evita ficar preso em manutenção quando existem múltiplas linhas antigas na webhook_config.
      const { data: latestConfig, error: tableError } = await supabase
        .from('webhook_config')
        .select(
          'manutencao_ativa, manutencao_mensagem, manutencao_inicio_programada, manutencao_fim_programada, manutencao_aviso_ativo, manutencao_aviso_mensagem'
        )
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tableError && latestConfig) {
        processMaintenanceData(latestConfig as MaintenanceStatus);
        return;
      }

      if (tableError) {
        console.warn('[Maintenance] Could not read webhook_config directly; falling back to RPC:', tableError);
      }

      // 2) Fallback: RPC
      const { data, error } = await supabase.rpc('get_maintenance_status');

      if (error) {
        console.error('Error checking maintenance status:', error);
        setIsMaintenanceMode(false);
        return;
      }

      if (data && data.length > 0) {
        const status = data[0] as MaintenanceStatus;
        processMaintenanceData(status);
      } else {
        setIsMaintenanceMode(false);
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
      setIsMaintenanceMode(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const processMaintenanceData = (status: MaintenanceStatus) => {
    try {
      localStorage.setItem(MAINT_CACHE_KEY, JSON.stringify(status));
    } catch {
      /* ignore quota */
    }
    const now = new Date();

    // Verifica manutenção manual
    let maintenanceActive = status.manutencao_ativa || false;

    // Verifica manutenção programada
    const startDate = status.manutencao_inicio_programada ? new Date(status.manutencao_inicio_programada) : null;
    const endDate = status.manutencao_fim_programada ? new Date(status.manutencao_fim_programada) : null;

    setScheduledStart(startDate);
    setScheduledEnd(endDate);

    // Se está dentro do período programado, ativa manutenção
    if (startDate && endDate && now >= startDate && now <= endDate) {
      maintenanceActive = true;
    }

    setIsMaintenanceMode(maintenanceActive);
    setMaintenanceMessage(status.manutencao_mensagem || null);

    // Aviso prévio
    setWarningActive(status.manutencao_aviso_ativo || false);
    setWarningMessage(status.manutencao_aviso_mensagem || null);
  };

  // Polling de segurança:
  // - Se estiver em manutenção, verifica frequentemente para destravar rápido quando desativar.
  // - Fora de manutenção, verifica em intervalos maiores (evita excesso de chamadas).
  const pollingDelayMs = isLoading ? null : isMaintenanceMode ? 2000 : 15000;
  useInterval(() => {
    void checkMaintenanceStatus();
  }, pollingDelayMs);

  // Verificar se dispositivo está autorizado - PRIORIDADE MÁXIMA
  const checkDeviceAuthorization = useCallback(async (): Promise<boolean> => {
    try {
      const fingerprint = localStorage.getItem('device_fingerprint');
      console.log('[Maintenance] Checking device authorization for fingerprint:', fingerprint);

      if (!fingerprint) {
        console.log('[Maintenance] No fingerprint found in localStorage');
        return false;
      }

      const { data, error } = await supabase.rpc('is_device_authorized', {
        p_fingerprint: fingerprint,
      });

      console.log('[Maintenance] Device authorization result:', data, 'error:', error);

      if (error) {
        console.error('Error checking device authorization:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking device authorization:', error);
      return false;
    }
  }, []);

  const checkAuthAndPermissions = useCallback(async () => {
    // PRIMEIRO: Verificar se o dispositivo está autorizado (PRIORIDADE MÁXIMA)
    // Isso acontece ANTES de qualquer outra verificação
    const isDeviceAuth = await checkDeviceAuthorization();
    console.log('[Maintenance] Device authorized:', isDeviceAuth);

    if (isDeviceAuth) {
      // Dispositivo autorizado = acesso total, independente de email ou login
      setIsAllowedUser(true);
      setIsAuthenticated(true); // Assume autenticado se dispositivo autorizado
      console.log('[Maintenance] Device is authorized - FULL ACCESS GRANTED');
      return;
    }

    // Se dispositivo NÃO está autorizado, verificar autenticação e email
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setIsAuthenticated(true);

      // Verifica se o email está na lista de permitidos
      if (user.email) {
        const { data: isAllowed } = await supabase.rpc('is_email_allowed_maintenance', {
          p_email: user.email,
        });

        console.log('[Maintenance] Email allowed:', isAllowed, 'for email:', user.email);

        if (isAllowed) {
          setIsAllowedUser(true);
          return;
        }
      }

      // Se não está na lista de emails/dispositivos permitidos, não tem acesso durante manutenção
      setIsAllowedUser(false);
    } else {
      setIsAuthenticated(false);
      setIsAllowedUser(false);
    }
  }, [checkDeviceAuthorization]);

  useEffect(() => {
    void checkMaintenanceStatus();
    void checkAuthAndPermissions();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkAuthAndPermissions();
    });

    // Subscribe to realtime changes
    const channel = supabase
      .channel('maintenance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhook_config',
        },
        () => {
          void checkMaintenanceStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dispositivos_autorizados',
        },
        () => {
          void checkAuthAndPermissions();
        }
      )
      .subscribe();

    // Refetch em foco/voltar para a aba (ajuda muito em “ficou preso na manutenção”)
    const handleFocus = () => {
      void checkMaintenanceStatus();
      void checkAuthAndPermissions();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkMaintenanceStatus();
        void checkAuthAndPermissions();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [checkMaintenanceStatus, checkAuthAndPermissions]);

  return {
    isMaintenanceMode,
    maintenanceMessage,
    isLoading,
    isAllowedUser,
    isAuthenticated,
    warningActive,
    warningMessage,
    scheduledStart,
    scheduledEnd,
    refresh: checkMaintenanceStatus,
  };
}

