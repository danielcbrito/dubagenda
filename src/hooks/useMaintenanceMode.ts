import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceConfig {
  manutencao_ativa: boolean;
  manutencao_mensagem: string | null;
}

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
      const { data, error } = await supabase
        .from('webhook_config')
        .select('manutencao_ativa, manutencao_mensagem')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking maintenance status:', error);
        setIsMaintenanceMode(false);
      } else if (data) {
        const config = data as MaintenanceConfig;
        setIsMaintenanceMode(config.manutencao_ativa || false);
        setMaintenanceMessage(config.manutencao_mensagem || null);
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
    refresh: checkMaintenanceStatus
  };
}
