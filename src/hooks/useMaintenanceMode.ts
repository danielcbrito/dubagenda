import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceStatus {
  manutencao_ativa: boolean;
  manutencao_mensagem: string | null;
  manutencao_inicio_programada: string | null;
  manutencao_fim_programada: string | null;
  manutencao_aviso_ativo: boolean;
  manutencao_aviso_mensagem: string | null;
}

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowedUser, setIsAllowedUser] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [warningActive, setWarningActive] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [scheduledStart, setScheduledStart] = useState<Date | null>(null);
  const [scheduledEnd, setScheduledEnd] = useState<Date | null>(null);

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_maintenance_status');

      if (error) {
        console.error('Error checking maintenance status:', error);
        setIsMaintenanceMode(false);
        setIsLoading(false);
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
    const now = new Date();
    
    // Verifica manutenção manual
    let maintenanceActive = status.manutencao_ativa || false;
    
    // Verifica manutenção programada
    const startDate = status.manutencao_inicio_programada 
      ? new Date(status.manutencao_inicio_programada) 
      : null;
    const endDate = status.manutencao_fim_programada 
      ? new Date(status.manutencao_fim_programada) 
      : null;
    
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
        p_fingerprint: fingerprint
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
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setIsAuthenticated(true);
      
      // Verifica se o email está na lista de permitidos
      if (user.email) {
        const { data: isAllowed } = await supabase.rpc('is_email_allowed_maintenance', {
          p_email: user.email
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
    checkMaintenanceStatus();
    checkAuthAndPermissions();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuthAndPermissions();
    });

    // Subscribe to realtime changes
    const channel = supabase
      .channel('maintenance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhook_config'
        },
        () => {
          checkMaintenanceStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dispositivos_autorizados'
        },
        () => {
          checkAuthAndPermissions();
        }
      )
      .subscribe();

    return () => {
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
    refresh: checkMaintenanceStatus
  };
}
