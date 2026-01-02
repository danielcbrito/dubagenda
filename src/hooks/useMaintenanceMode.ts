import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceStatus {
  manutencao_ativa: boolean;
  manutencao_mensagem: string | null;
  manutencao_inicio_programada: string | null;
  manutencao_fim_programada: string | null;
  manutencao_aviso_ativo: boolean;
  manutencao_aviso_mensagem: string | null;
  manutencao_ips_permitidos: string[] | null;
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
  const [currentUserIP, setCurrentUserIP] = useState<string | null>(null);

  // Busca IP do usuário
  const fetchUserIP = useCallback(async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setCurrentUserIP(data.ip);
      return data.ip;
    } catch (error) {
      console.error('Error fetching IP:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchUserIP();
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
        
        if (isAllowed) {
          setIsAllowedUser(true);
          return;
        }
      }
      
      // Se não é admin nem email permitido, verifica IP
      setIsAllowedUser(false);
    } else {
      setIsAuthenticated(false);
      setIsAllowedUser(false);
    }
  };

  const checkMaintenanceStatus = async () => {
    try {
      // Usa a nova função que inclui IPs
      const { data, error } = await supabase.rpc('get_maintenance_status_with_ips');

      if (error) {
        // Fallback para função antiga se a nova não existir
        const { data: oldData, error: oldError } = await supabase.rpc('get_maintenance_status');
        if (oldError) {
          console.error('Error checking maintenance status:', oldError);
          setIsMaintenanceMode(false);
          setIsLoading(false);
          return;
        }
        if (oldData && oldData.length > 0) {
          processMaintenanceData(oldData[0], []);
        }
        return;
      }

      if (data && data.length > 0) {
        const status = data[0] as MaintenanceStatus;
        processMaintenanceData(status, status.manutencao_ips_permitidos || []);
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

  const processMaintenanceData = async (status: Partial<MaintenanceStatus>, allowedIPs: string[]) => {
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

    // Verifica se o IP do usuário está permitido
    if (maintenanceActive && allowedIPs.length > 0) {
      const userIP = currentUserIP || await fetchUserIP();
      if (userIP && allowedIPs.includes(userIP)) {
        setIsAllowedUser(true);
      }
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
    currentUserIP,
    refresh: checkMaintenanceStatus
  };
}
