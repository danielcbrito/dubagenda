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
  const [isAllowedUser, setIsAllowedUser] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [warningActive, setWarningActive] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [scheduledStart, setScheduledStart] = useState<Date | null>(null);
  const [scheduledEnd, setScheduledEnd] = useState<Date | null>(null);

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
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuthAndPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setIsAuthenticated(true);
      
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (adminRole) {
        setIsAllowedUser(true);
        return;
      }
      
      // Check if user's email is in allowed list
      if (user.email) {
        const { data: isAllowed } = await supabase.rpc('is_email_allowed_maintenance', {
          p_email: user.email
        });
        
        setIsAllowedUser(!!isAllowed);
      } else {
        setIsAllowedUser(false);
      }
    } else {
      setIsAuthenticated(false);
      setIsAllowedUser(false);
    }
  };

  const checkMaintenanceStatus = async () => {
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
    isAllowedUser,
    isAuthenticated,
    warningActive,
    warningMessage,
    scheduledStart,
    scheduledEnd,
    refresh: checkMaintenanceStatus
  };
}
