import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * HOOK DE DISPONIBILIDADE DE HORÁRIOS - V2 (BACKEND-FIRST)
 * 
 * Este hook SEMPRE consulta o backend (Edge Function) como
 * fonte única da verdade para disponibilidade.
 * 
 * FLUXO:
 * 1. Chama Edge Function check-availability
 * 2. Recebe slots já calculados pelo backend
 * 3. Mantém realtime listener para atualizações
 * 4. Polling de backup a cada 8 segundos
 */

export interface TimeSlot {
  time: string;
  available: boolean;
  blockedReason?: 'occupied' | 'minimum_advance' | 'lunch' | 'closed';
}

interface OccupiedSlot {
  hora: string;
  duracao: number;
  status: string;
  source: 'agendamento' | 'pending_booking';
}

interface AvailabilityResponse {
  success: boolean;
  date: string;
  slots: TimeSlot[];
  occupiedSlots: OccupiedSlot[];
  message?: string;
}

const SUPABASE_URL = 'https://djtpzvujzmrrslirzwun.supabase.co';

export function useSlotAvailability(
  selectedDate: Date | undefined,
  serviceDuration: number,
  excludeAppointmentId?: string | null
) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Função principal que carrega os slots do BACKEND
   * A Edge Function check-availability é a ÚNICA fonte da verdade
   */
  const loadSlots = useCallback(async () => {
    if (!selectedDate || serviceDuration <= 0) {
      setSlots([]);
      setOccupiedSlots([]);
      return;
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    console.log('='.repeat(60));
    console.log('[useSlotAvailability] CHAMANDO BACKEND');
    console.log(`[useSlotAvailability] Data: ${dateStr} | Duração: ${serviceDuration}min`);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/check-availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: dateStr,
            duration: serviceDuration,
            excludeAppointmentId: excludeAppointmentId || undefined
          }),
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AvailabilityResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Erro ao verificar disponibilidade');
      }

      console.log(`[useSlotAvailability] RESPOSTA DO BACKEND:`);
      console.log(`  → Slots: ${data.slots.length}`);
      console.log(`  → Disponíveis: ${data.slots.filter(s => s.available).length}`);
      console.log(`  → Ocupados no DB: ${data.occupiedSlots.length}`);
      data.occupiedSlots.forEach(os => {
        console.log(`    → ${os.hora} | ${os.duracao}min | ${os.status} | ${os.source}`);
      });
      console.log('='.repeat(60));

      setSlots(data.slots);
      setOccupiedSlots(data.occupiedSlots);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[useSlotAvailability] Requisição cancelada');
        return;
      }
      console.error('[useSlotAvailability] ERRO:', err);
      setError('Erro ao carregar horários');
      
      // Fallback: carregar direto do banco se Edge Function falhar
      console.log('[useSlotAvailability] Tentando fallback direto do banco...');
      await loadSlotsFromDatabase(dateStr);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, serviceDuration, excludeAppointmentId]);

  /**
   * Fallback: carregar slots diretamente do banco
   * Usado apenas se a Edge Function falhar
   */
  const loadSlotsFromDatabase = useCallback(async (dateStr: string) => {
    try {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const isToday = dateStr === todayStr;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const minimumAdvanceMinutes = isToday ? currentMinutes + 60 : 0;

      // Buscar agendamentos
      const { data: appointments, error: aptError } = await supabase
        .from('agendamentos')
        .select('id, hora, duracao, status')
        .eq('data', dateStr)
        .in('status', ['pending', 'confirmed', 'completed']);

      if (aptError) throw aptError;

      // Buscar pending_bookings
      const { data: pendingBookings } = await supabase
        .from('pending_bookings')
        .select('id, hora, duracao')
        .eq('data', dateStr)
        .gt('expires_at', now.toISOString());

      const allOccupied = [
        ...(appointments || []).map(apt => ({
          hora: apt.hora,
          duracao: apt.duracao,
          status: apt.status,
          source: 'agendamento' as const
        })),
        ...(pendingBookings || []).map(pb => ({
          hora: pb.hora,
          duracao: pb.duracao,
          status: 'pending_booking',
          source: 'pending_booking' as const
        }))
      ];

      // Gerar slots
      const generatedSlots: TimeSlot[] = [];
      const OPEN_HOUR = 9;
      const CLOSE_HOUR = 20;
      const LUNCH_START = 13 * 60;
      const LUNCH_END = 14 * 60;

      for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const slotStartMinutes = hour * 60 + minute;
          const slotEndMinutes = slotStartMinutes + serviceDuration;

          if (slotEndMinutes > CLOSE_HOUR * 60) continue;

          const overlapsLunch = (
            (slotStartMinutes >= LUNCH_START && slotStartMinutes < LUNCH_END) ||
            (slotEndMinutes > LUNCH_START && slotEndMinutes <= LUNCH_END) ||
            (slotStartMinutes < LUNCH_START && slotEndMinutes > LUNCH_END)
          );
          if (overlapsLunch) continue;

          if (isToday && slotStartMinutes < minimumAdvanceMinutes) {
            generatedSlots.push({ time: timeStr, available: false, blockedReason: 'minimum_advance' });
            continue;
          }

          let isOccupied = false;
          for (const occupied of allOccupied) {
            const [occHour, occMinute] = occupied.hora.split(':').map(Number);
            const occStartMinutes = occHour * 60 + occMinute;
            const occEndMinutes = occStartMinutes + occupied.duracao;
            const hasOverlap = slotStartMinutes < occEndMinutes && slotEndMinutes > occStartMinutes;
            if (hasOverlap) {
              isOccupied = true;
              break;
            }
          }

          generatedSlots.push({
            time: timeStr,
            available: !isOccupied,
            blockedReason: isOccupied ? 'occupied' : undefined
          });
        }
      }

      setSlots(generatedSlots);
      setOccupiedSlots(allOccupied);
      console.log('[useSlotAvailability] Fallback concluído com sucesso');

    } catch (err) {
      console.error('[useSlotAvailability] Erro no fallback:', err);
      setError('Erro ao carregar horários');
    }
  }, [serviceDuration]);

  /**
   * Configurar listeners em tempo real e polling
   */
  useEffect(() => {
    if (!selectedDate || serviceDuration <= 0) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Limpar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Limpar polling anterior
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Carregar slots inicialmente
    loadSlots();

    // Configurar canal de realtime
    const channelName = `slot-availability-${dateStr}-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos',
          filter: `data=eq.${dateStr}`
        },
        (payload) => {
          console.log('[Realtime] Mudança em agendamentos:', payload.eventType);
          loadSlots();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_bookings',
          filter: `data=eq.${dateStr}`
        },
        (payload) => {
          console.log('[Realtime] Mudança em pending_bookings:', payload.eventType);
          loadSlots();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status do canal ${channelName}:`, status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Canal conectado, recarregando slots...');
          loadSlots();
        }
      });

    channelRef.current = channel;

    // Polling de backup (a cada 8 segundos)
    pollIntervalRef.current = setInterval(() => {
      console.log('[Polling] Atualizando slots...');
      loadSlots();
    }, 8000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [selectedDate, serviceDuration, loadSlots]);

  /**
   * Função para forçar recarga dos slots
   */
  const refreshSlots = useCallback(() => {
    loadSlots();
  }, [loadSlots]);

  /**
   * Função para verificar se um horário específico está disponível
   * Faz uma verificação DIRETA no banco (double-check)
   */
  const verifySlotAvailability = useCallback(async (time: string): Promise<{
    available: boolean;
    message?: string;
  }> => {
    if (!selectedDate) {
      return { available: false, message: 'Data não selecionada' };
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const [hour, minute] = time.split(':').map(Number);
    const slotStartMinutes = hour * 60 + minute;
    const slotEndMinutes = slotStartMinutes + serviceDuration;

    console.log(`[verifySlotAvailability] Verificando ${dateStr} ${time} (${slotStartMinutes}-${slotEndMinutes})`);

    try {
      // Buscar TODOS os agendamentos do dia com status bloqueante
      let query = supabase
        .from('agendamentos')
        .select('id, hora, duracao, status')
        .eq('data', dateStr)
        .in('status', ['pending', 'confirmed', 'completed']);

      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
      }

      const { data: appointments, error } = await query;

      if (error) {
        console.error('[verifySlotAvailability] Erro:', error);
        return { available: false, message: 'Erro ao verificar disponibilidade' };
      }

      // Verificar conflitos com agendamentos
      for (const apt of appointments || []) {
        const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
        const aptStartMinutes = aptHour * 60 + aptMinute;
        const aptEndMinutes = aptStartMinutes + apt.duracao;

        const hasOverlap = slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes;

        if (hasOverlap) {
          console.log(`[verifySlotAvailability] ❌ CONFLITO com ${apt.hora} (${apt.status})`);
          return {
            available: false,
            message: 'Este horário já foi reservado. Por favor, escolha outro.'
          };
        }
      }

      // Verificar pending_bookings
      const { data: pendingBookings } = await supabase
        .from('pending_bookings')
        .select('id, hora, duracao')
        .eq('data', dateStr)
        .gt('expires_at', new Date().toISOString());

      for (const pb of pendingBookings || []) {
        const [pbHour, pbMinute] = pb.hora.split(':').map(Number);
        const pbStartMinutes = pbHour * 60 + pbMinute;
        const pbEndMinutes = pbStartMinutes + pb.duracao;

        const hasOverlap = slotStartMinutes < pbEndMinutes && slotEndMinutes > pbStartMinutes;

        if (hasOverlap) {
          console.log(`[verifySlotAvailability] ❌ CONFLITO com pending_booking ${pb.hora}`);
          return {
            available: false,
            message: 'Este horário está temporariamente reservado. Tente outro horário.'
          };
        }
      }

      console.log(`[verifySlotAvailability] ✅ Horário DISPONÍVEL`);
      return { available: true };

    } catch (err) {
      console.error('[verifySlotAvailability] Erro geral:', err);
      return { available: false, message: 'Erro ao verificar disponibilidade' };
    }
  }, [selectedDate, serviceDuration, excludeAppointmentId]);

  return {
    slots,
    loading,
    error,
    occupiedSlots,
    refreshSlots,
    verifySlotAvailability
  };
}
