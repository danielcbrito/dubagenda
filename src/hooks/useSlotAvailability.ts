import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type AppointmentStatus = Database['public']['Enums']['appointment_status'];

/**
 * HOOK DE DISPONIBILIDADE DE HORÁRIOS
 * 
 * Este hook é a ÚNICA fonte de verdade para determinar
 * quais horários estão disponíveis para agendamento.
 * 
 * REGRAS DE BLOQUEIO:
 * - pending, confirmed, completed → BLOQUEIA
 * - cancelled_by_user, cancelled_by_admin, no_show, excluido → LIBERA
 * - pending_bookings não expirados → BLOQUEIA
 * 
 * HORÁRIO DE FUNCIONAMENTO:
 * - Segunda a Sábado: 09:00 às 20:00
 * - Almoço: 13:00 às 14:00 (fechado)
 * - Domingo: fechado
 */

export interface TimeSlot {
  time: string;
  available: boolean;
  blockedReason?: 'occupied' | 'minimum_advance' | 'lunch' | 'closed';
}

interface OccupiedSlot {
  hora: string;
  duracao: number;
  source: 'agendamento' | 'pending_booking';
  status?: string;
}

// Status que BLOQUEIAM o horário (qualquer outro status = livre)
const BLOCKING_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'completed'];

export function useSlotAvailability(
  selectedDate: Date | undefined,
  serviceDuration: number,
  excludeAppointmentId?: string | null
) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Função principal que carrega os slots disponíveis
   * Consulta DIRETAMENTE o banco de dados (fonte da verdade)
   */
  const loadSlots = useCallback(async () => {
    if (!selectedDate || serviceDuration <= 0) {
      setSlots([]);
      return;
    }

    setLoading(true);
    setError(null);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const isToday = dateStr === todayStr;

    // Tempo mínimo de antecedência para agendamentos no mesmo dia (1 hora)
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minimumAdvanceMinutes = isToday ? currentMinutes + 60 : 0;

    console.log('='.repeat(60));
    console.log('[useSlotAvailability] INICIANDO CARGA DE SLOTS');
    console.log(`[useSlotAvailability] Data: ${dateStr} | Duração: ${serviceDuration}min`);
    console.log(`[useSlotAvailability] É hoje: ${isToday} | Mínimo: ${minimumAdvanceMinutes}min`);

    try {
      // =====================================================
      // CONSULTA 1: Agendamentos existentes (FONTE DA VERDADE)
      // =====================================================
      let appointmentsQuery = supabase
        .from('agendamentos')
        .select('id, hora, duracao, status')
        .eq('data', dateStr)
        .in('status', BLOCKING_STATUSES);

      // Se for reagendamento, excluir o próprio agendamento
      if (excludeAppointmentId) {
        appointmentsQuery = appointmentsQuery.neq('id', excludeAppointmentId);
      }

      const { data: appointments, error: aptError } = await appointmentsQuery;

      if (aptError) {
        console.error('[useSlotAvailability] ERRO ao buscar agendamentos:', aptError);
        setError('Erro ao verificar disponibilidade');
        setLoading(false);
        return;
      }

      console.log(`[useSlotAvailability] Agendamentos encontrados: ${appointments?.length || 0}`);
      if (appointments && appointments.length > 0) {
        appointments.forEach(apt => {
          console.log(`  → ${apt.hora} | ${apt.duracao}min | ${apt.status} | ID: ${apt.id.substring(0, 8)}`);
        });
      }

      // =====================================================
      // CONSULTA 2: Reservas pendentes (aguardando pagamento)
      // =====================================================
      const { data: pendingBookings, error: pendingError } = await supabase
        .from('pending_bookings')
        .select('id, hora, duracao, expires_at')
        .eq('data', dateStr)
        .gt('expires_at', now.toISOString());

      if (pendingError) {
        console.error('[useSlotAvailability] ERRO ao buscar pending_bookings:', pendingError);
        // Continuar mesmo com erro - não bloquear por causa de pending_bookings
      }

      console.log(`[useSlotAvailability] Pending bookings: ${pendingBookings?.length || 0}`);
      if (pendingBookings && pendingBookings.length > 0) {
        pendingBookings.forEach(pb => {
          console.log(`  → ${pb.hora} | ${pb.duracao}min | Expira: ${pb.expires_at}`);
        });
      }

      // =====================================================
      // COMBINAR TODOS OS SLOTS OCUPADOS
      // =====================================================
      const occupiedSlots: OccupiedSlot[] = [
        ...(appointments || []).map(apt => ({
          hora: apt.hora,
          duracao: apt.duracao,
          source: 'agendamento' as const,
          status: apt.status
        })),
        ...(pendingBookings || []).map(pb => ({
          hora: pb.hora,
          duracao: pb.duracao,
          source: 'pending_booking' as const
        }))
      ];

      // =====================================================
      // GERAR SLOTS DE HORÁRIO (09:00 - 20:00)
      // =====================================================
      const generatedSlots: TimeSlot[] = [];
      const OPEN_HOUR = 9;    // 09:00
      const CLOSE_HOUR = 20;  // 20:00
      const LUNCH_START = 13 * 60; // 13:00 em minutos
      const LUNCH_END = 14 * 60;   // 14:00 em minutos

      for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const slotStartMinutes = hour * 60 + minute;
          const slotEndMinutes = slotStartMinutes + serviceDuration;

          // REGRA 1: Não pode ultrapassar horário de fechamento
          if (slotEndMinutes > CLOSE_HOUR * 60) {
            continue; // Não adiciona este slot
          }

          // REGRA 2: Não pode estar no horário de almoço
          const overlapsLunch = (
            (slotStartMinutes >= LUNCH_START && slotStartMinutes < LUNCH_END) ||
            (slotEndMinutes > LUNCH_START && slotEndMinutes <= LUNCH_END) ||
            (slotStartMinutes < LUNCH_START && slotEndMinutes > LUNCH_END)
          );

          if (overlapsLunch) {
            continue; // Não adiciona este slot
          }

          // REGRA 3: Antecedência mínima de 1 hora para mesmo dia
          if (isToday && slotStartMinutes < minimumAdvanceMinutes) {
            generatedSlots.push({
              time: timeStr,
              available: false,
              blockedReason: 'minimum_advance'
            });
            continue;
          }

          // REGRA 4: Verificar conflito com agendamentos existentes
          let isOccupied = false;
          let conflictInfo = '';

          for (const occupied of occupiedSlots) {
            // Parse hora (formato pode ser "09:00" ou "09:00:00")
            const [occHour, occMinute] = occupied.hora.split(':').map(Number);
            const occStartMinutes = occHour * 60 + occMinute;
            const occEndMinutes = occStartMinutes + occupied.duracao;

            // FÓRMULA DE SOBREPOSIÇÃO:
            // Dois intervalos [A, B) e [C, D) se sobrepõem quando: A < D E B > C
            const hasOverlap = slotStartMinutes < occEndMinutes && slotEndMinutes > occStartMinutes;

            if (hasOverlap) {
              isOccupied = true;
              conflictInfo = `${occupied.source} às ${occupied.hora} (${occStartMinutes}-${occEndMinutes})`;
              break;
            }
          }

          if (isOccupied) {
            console.log(`[useSlotAvailability] ❌ BLOQUEADO ${timeStr} (${slotStartMinutes}-${slotEndMinutes}) → Conflito: ${conflictInfo}`);
          }

          generatedSlots.push({
            time: timeStr,
            available: !isOccupied,
            blockedReason: isOccupied ? 'occupied' : undefined
          });
        }
      }

      // =====================================================
      // RESULTADO FINAL
      // =====================================================
      const availableCount = generatedSlots.filter(s => s.available).length;
      const blockedCount = generatedSlots.filter(s => !s.available).length;
      
      console.log(`[useSlotAvailability] RESULTADO FINAL:`);
      console.log(`  → Total de slots: ${generatedSlots.length}`);
      console.log(`  → Disponíveis: ${availableCount}`);
      console.log(`  → Bloqueados: ${blockedCount}`);
      console.log('='.repeat(60));

      setSlots(generatedSlots);

    } catch (err) {
      console.error('[useSlotAvailability] ERRO GERAL:', err);
      setError('Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, serviceDuration, excludeAppointmentId]);

  /**
   * Configurar listeners em tempo real
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
        .in('status', BLOCKING_STATUSES);

      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
      }

      const { data: appointments, error } = await query;

      if (error) {
        console.error('[verifySlotAvailability] Erro:', error);
        return { available: false, message: 'Erro ao verificar disponibilidade' };
      }

      // Verificar conflitos
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
    refreshSlots,
    verifySlotAvailability
  };
}
