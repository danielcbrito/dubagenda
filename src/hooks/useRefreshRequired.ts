import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRefreshRequired() {
  const [showRefreshOverlay, setShowRefreshOverlay] = useState(false);

  const checkRefreshRequired = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_config')
        .select('refresh_client_required_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Refresh] Error fetching refresh config:', error);
        return;
      }

      if (data?.refresh_client_required_at) {
        const lastRefreshAck = sessionStorage.getItem('last_refresh_ack');
        const requiredAt = new Date(data.refresh_client_required_at);
        
        if (!lastRefreshAck || requiredAt > new Date(lastRefreshAck)) {
          setShowRefreshOverlay(true);
        } else {
          setShowRefreshOverlay(false);
        }
      } else {
        setShowRefreshOverlay(false);
      }
    } catch (error) {
      console.error('[Refresh] Error in checkRefreshRequired:', error);
    }
  }, []);

  useEffect(() => {
    // Initial check
    void checkRefreshRequired();

    // Subscribe to Realtime changes on webhook_config
    const channel = supabase
      .channel('refresh-required-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'webhook_config',
        },
        (payload) => {
          if (payload.new && 'refresh_client_required_at' in payload.new) {
            void checkRefreshRequired();
          }
        }
      )
      .subscribe();

    // Also check on window focus
    window.addEventListener('focus', checkRefreshRequired);

    return () => {
      window.removeEventListener('focus', checkRefreshRequired);
      supabase.removeChannel(channel);
    };
  }, [checkRefreshRequired]);

  const handleRefresh = async () => {
    try {
      const { data } = await supabase
        .from('webhook_config')
        .select('refresh_client_required_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.refresh_client_required_at) {
        sessionStorage.setItem('last_refresh_ack', data.refresh_client_required_at);
      }
      
      window.location.reload();
    } catch (error) {
      console.error('[Refresh] Error during manual refresh:', error);
      window.location.reload();
    }
  };

  return { showRefreshOverlay, handleRefresh };
}
