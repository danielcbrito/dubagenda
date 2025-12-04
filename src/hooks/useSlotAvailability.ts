import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * HOOK DE DISPONIBILIDADE DE HORÁRIOS - V3 (BACKEND-FIRST + FALLBACK CORRIGIDO)
 * 
 * Este hook SEMPRE consulta o backend (Edge Function) como
 * fonte única da verdade para disponibilidade.
 * 
 * REGRA DE DISPONIBILIDADE:
 * próximo_horário_disponível = horário_fim_do_serviço + delay (10min)
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
  fim?: string;
  fimComDelay?: string;
}

interface AvailabilityResponse {
  success: boolean;
  date: string;
  slots: TimeSlot[];
  occupiedSlots: OccupiedSlot[];
  message?: string;
}

const SUPABASE_URL = 'https://djtpzvujzmrrslirzwun.supabase.co';

// Constantes de configuração padrão
const DEFAULT_DELAY_MINUTES = 10;
const SLOT_INTERVAL = 10;
const MINIMUM_ADVANCE_MINUTES = 60; // 1 hora de antecedência

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

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
      console.log('[useSlotAvailability] Data ou duração inválida, limpando slots');
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

      const availableCount = data.slots.filter(s => s.available).length;
      const blockedCount = data.slots.filter(s => !s.available).length;

      console.log(`[useSlotAvailability] RESPOSTA DO BACKEND:`);
      console.log(`  → Total de slots: ${data.slots.length}`);
      console.log(`  → Disponíveis: ${availableCount}`);
      console.log(`  → Bloqueados: ${blockedCount}`);
      console.log(`  → Ocupados no DB: ${data.occupiedSlots.length}`);
      
      if (data.occupiedSlots.length > 0) {
        console.log('  → Detalhes dos ocupados:');
        data.occupiedSlots.forEach(os => {
          console.log(`     - ${os.hora} (${os.duracao}min) | ${os.status} | fim: ${os.fim || 'N/A'} | livre após: ${os.fimComDelay || 'N/A'}`);
        });
      }
      console.log('='.repeat(60));

      setSlots(data.slots);
      setOccupiedSlots(data.occupiedSlots);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[useSlotAvailability] Requisição cancelada');
        return;
      }
      console.error('[useSlotAvailability] ERRO na Edge Function:', err);
      setError('Erro ao carregar horários');
      
      // Fallback: carregar direto do banco se Edge Function falhar
      console.log('[useSlotAvailability] Usando FALLBACK direto do banco...');
      await loadSlotsFromDatabase(dateStr);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, serviceDuration, excludeAppointmentId]);

  /**
   * Fallback CORRIGIDO: carregar slots diretamente do banco
   * Usa as MESMAS regras do backend (intervalo de 10min, delay de 10min)
   */
  const loadSlotsFromDatabase = useCallback(async (dateStr: string) => {
    try {
      console.log('[useSlotAvailability FALLBACK] Iniciando carregamento direto...');
      
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const isToday = dateStr === todayStr;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const minimumAdvanceMinutes = isToday ? currentMinutes + MINIMUM_ADVANCE_MINUTES : 0;

      // Buscar configuração do dia
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();

      const { data: configData } = await supabase
        .from('configuracoes_horario')
        .select('*')
        .eq('dia_semana', dayOfWeek)
        .maybeSingle();

      const config = configData || {
        aberto: dayOfWeek !== 0,
        hora_abertura: '09:00',
        hora_fechamento: dayOfWeek >= 3 && dayOfWeek <= 6 ? '21:00' : '20:00',
        hora_almoco_inicio: '13:00',
        hora_almoco_fim: '14:00',
        delay_entre_servicos: DEFAULT_DELAY_MINUTES
      };

      if (!config.aberto) {
        console.log('[useSlotAvailability FALLBACK] Dia fechado');
        setSlots([]);
        setOccupiedSlots([]);
        return;
      }

      const OPEN_MINUTES = timeToMinutes(config.hora_abertura);
      const CLOSE_MINUTES = timeToMinutes(config.hora_fechamento);
      const LUNCH_START = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
      const LUNCH_END = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;
      const DELAY_MINUTES = config.delay_entre_servicos || DEFAULT_DELAY_MINUTES;

      // Buscar agendamentos com status bloqueante
      const { data: appointments, error: aptError } = await supabase
        .from('agendamentos')
        .select('id, hora, duracao, status')
        .eq('data', dateStr)
        .in('status', ['pending', 'confirmed', 'completed']);

      if (aptError) throw aptError;

      // Buscar pending_bookings não expirados
      const { data: pendingBookings } = await supabase
        .from('pending_bookings')
        .select('id, hora, duracao, expires_at')
        .eq('data', dateStr)
        .gt('expires_at', now.toISOString());

      // Processar slots ocupados
      const allOccupied: OccupiedSlot[] = [
        ...(appointments || []).map(apt => {
          const startMinutes = timeToMinutes(apt.hora);
          const endMinutes = startMinutes + apt.duracao;
          return {
            hora: apt.hora,
            duracao: apt.duracao,
            status: apt.status,
            source: 'agendamento' as const,
            fim: minutesToTime(endMinutes),
            fimComDelay: minutesToTime(endMinutes + DELAY_MINUTES)
          };
        }),
        ...(pendingBookings || []).map(pb => {
          const startMinutes = timeToMinutes(pb.hora);
          const endMinutes = startMinutes + pb.duracao;
          return {
            hora: pb.hora,
            duracao: pb.duracao,
            status: 'pending_booking',
            source: 'pending_booking' as const,
            fim: minutesToTime(endMinutes),
            fimComDelay: minutesToTime(endMinutes + DELAY_MINUTES)
          };
        })
      ];

      console.log(`[useSlotAvailability FALLBACK] ${allOccupied.length} slots ocupados encontrados`);

      // Gerar slots a cada 10 minutos (igual ao backend)
      const generatedSlots: TimeSlot[] = [];

      for (let slotStartMinutes = OPEN_MINUTES; slotStartMinutes < CLOSE_MINUTES; slotStartMinutes += SLOT_INTERVAL) {
        const timeStr = minutesToTime(slotStartMinutes);
        const slotEndMinutes = slotStartMinutes + serviceDuration;

        // 1. Verificar se cabe antes do fechamento
        if (slotEndMinutes > CLOSE_MINUTES) continue;

        // 2. Verificar almoço
        if (LUNCH_START !== null && LUNCH_END !== null) {
          if (slotStartMinutes >= LUNCH_START && slotStartMinutes < LUNCH_END) continue;
          if (slotEndMinutes > LUNCH_START && slotEndMinutes <= LUNCH_END) continue;
          if (slotStartMinutes < LUNCH_START && slotEndMinutes > LUNCH_END) continue;
        }

        // 3. Verificar antecedência mínima
        if (isToday && slotStartMinutes < minimumAdvanceMinutes) {
          generatedSlots.push({ time: timeStr, available: false, blockedReason: 'minimum_advance' });
          continue;
        }

        // 4. Verificar conflitos (MESMA LÓGICA DO BACKEND)
        let isBlocked = false;
        for (const occupied of allOccupied) {
          const occStartMinutes = timeToMinutes(occupied.hora);
          const occEndMinutes = occStartMinutes + occupied.duracao;
          const occEndWithDelayMinutes = occEndMinutes + DELAY_MINUTES;

          // Conflito: novo slot começa antes do fim+delay E termina depois do início
          const hasConflict = (slotStartMinutes < occEndWithDelayMinutes) && (slotEndMinutes > occStartMinutes);

          if (hasConflict) {
            isBlocked = true;
            break;
          }
        }

        generatedSlots.push({
          time: timeStr,
          available: !isBlocked,
          blockedReason: isBlocked ? 'occupied' : undefined
        });
      }

      const availableCount = generatedSlots.filter(s => s.available).length;
      console.log(`[useSlotAvailability FALLBACK] ${generatedSlots.length} slots gerados | ${availableCount} disponíveis`);

      setSlots(generatedSlots);
      setOccupiedSlots(allOccupied);

    } catch (err) {
      console.error('[useSlotAvailability FALLBACK] Erro:', err);
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
        console.log(`[Realtime] Status do canal:`, status);
        if (status === 'SUBSCRIBED') {
          loadSlots();
        }
      });

    channelRef.current = channel;

    // Polling de backup (a cada 8 segundos)
    pollIntervalRef.current = setInterval(() => {
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
    const slotStartMinutes = timeToMinutes(time);
    const slotEndMinutes = slotStartMinutes + serviceDuration;

    console.log(`[verifySlotAvailability] Verificando ${dateStr} ${time} (${minutesToTime(slotStartMinutes)}-${minutesToTime(slotEndMinutes)})`);

    try {
      // Buscar configuração do dia para pegar o delay
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();

      const { data: configData } = await supabase
        .from('configuracoes_horario')
        .select('delay_entre_servicos')
        .eq('dia_semana', dayOfWeek)
        .maybeSingle();

      const DELAY_MINUTES = configData?.delay_entre_servicos || DEFAULT_DELAY_MINUTES;

      // Buscar agendamentos com status bloqueante
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
        const aptStartMinutes = timeToMinutes(apt.hora);
        const aptEndMinutes = aptStartMinutes + apt.duracao;
        const aptEndWithDelayMinutes = aptEndMinutes + DELAY_MINUTES;

        const hasConflict = (slotStartMinutes < aptEndWithDelayMinutes) && (slotEndMinutes > aptStartMinutes);

        if (hasConflict) {
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
        const pbStartMinutes = timeToMinutes(pb.hora);
        const pbEndMinutes = pbStartMinutes + pb.duracao;
        const pbEndWithDelayMinutes = pbEndMinutes + DELAY_MINUTES;

        const hasConflict = (slotStartMinutes < pbEndWithDelayMinutes) && (slotEndMinutes > pbStartMinutes);

        if (hasConflict) {
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
