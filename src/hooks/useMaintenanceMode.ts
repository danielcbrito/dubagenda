import { useState, useEffect } from 'react';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [warningActive, setWarningActive] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [scheduledStart, setScheduledStart] = useState<Date | null>(null);
  const [scheduledEnd, setScheduledEnd] = useState<Date | null>(null);

  useEffect(() => {
    checkMaintenanceStatus();
    checkIsAdmin();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkIsAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!!data);
    }
  };

  const checkMaintenanceStatus = async () => {
    try {
      // Usa RPC segura que funciona sem login (SECURITY DEFINER)
      const { data, error } = await supabase.rpc('get_maintenance_status');

      if (error) {
        console.error('Error checking maintenance status:', error);
        setIsMaintenanceMode(false);
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const status = data[0] as MaintenanceStatus;
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
      } else {
        setIsMaintenanceMode(false);
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
      setIsMaintenanceMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isMaintenanceMode,
    maintenanceMessage,
    isLoading,
    isAdmin,
    warningActive,
    warningMessage,
    scheduledStart,
    scheduledEnd,
    refresh: checkMaintenanceStatus
  };
}
