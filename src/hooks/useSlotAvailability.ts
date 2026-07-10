import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * HOOK DE DISPONIBILIDADE DE HORÁRIOS - V4 (PARTIAL UPDATES)
 * 
 * MELHORIAS NA V4:
 * - Updates parciais: apenas slots que mudaram são atualizados no state
 * - Sem re-render completo da lista
 * - Mantém posição do scroll
 * - Transições suaves
 * 
 * REGRA DE DISPONIBILIDADE:
 * próximo_horário_disponível = horário_fim_do_serviço + delay (10min)
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

interface AvailabilityResponseEnvelope {
  success?: boolean;
  date?: string;
  slots?: TimeSlot[];
  occupiedSlots?: OccupiedSlot[];
  message?: string;
  data?: {
    success?: boolean;
    date?: string;
    slots?: TimeSlot[];
    occupiedSlots?: OccupiedSlot[];
    message?: string;
  };
}

function normalizeAvailabilityResponse(payload: AvailabilityResponseEnvelope): AvailabilityResponse {
  const hasNestedData = !!payload.data && (
    Array.isArray(payload.data.slots) ||
    Array.isArray(payload.data.occupiedSlots) ||
    typeof payload.data.message === 'string' ||
    typeof payload.data.success === 'boolean'
  );

  const normalized = hasNestedData ? payload.data! : payload;

  return {
    success: normalized.success ?? true,
    date: normalized.date ?? '',
    slots: normalized.slots ?? [],
    occupiedSlots: normalized.occupiedSlots ?? [],
    message: normalized.message,
  };
}

const SUPABASE_URL = 'https://djtpzvujzmrrslirzwun.supabase.co';

// Constantes de configuração padrão
const DEFAULT_DELAY_MINUTES = 10;
const SLOT_INTERVAL = 10;
const MINIMUM_ADVANCE_MINUTES = 30; // 30 min de antecedência

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Compara dois arrays de slots e retorna se são diferentes
 */
function slotsAreDifferent(oldSlots: TimeSlot[], newSlots: TimeSlot[]): boolean {
  if (oldSlots.length !== newSlots.length) return true;
  
  for (let i = 0; i < oldSlots.length; i++) {
    if (oldSlots[i].time !== newSlots[i].time ||
        oldSlots[i].available !== newSlots[i].available ||
        oldSlots[i].blockedReason !== newSlots[i].blockedReason) {
      return true;
    }
  }
  return false;
}

/**
 * Aplica updates parciais aos slots existentes
 * Retorna um novo array apenas se houve mudanças
 */
function applyPartialUpdate(existingSlots: TimeSlot[], newSlots: TimeSlot[]): TimeSlot[] | null {
  if (existingSlots.length === 0) return newSlots;
  if (newSlots.length === 0) return null;
  
  // Criar mapa dos novos slots
  const newSlotsMap = new Map<string, TimeSlot>();
  newSlots.forEach(slot => newSlotsMap.set(slot.time, slot));
  
  let hasChanges = false;
  const updatedSlots = existingSlots.map(existingSlot => {
    const newSlot = newSlotsMap.get(existingSlot.time);
    
    if (!newSlot) {
      // Slot removido - manter como indisponível
      if (existingSlot.available) {
        hasChanges = true;
        return { ...existingSlot, available: false, blockedReason: 'occupied' as const };
      }
      return existingSlot;
    }
    
    // Verificar se o slot mudou
    if (existingSlot.available !== newSlot.available || 
        existingSlot.blockedReason !== newSlot.blockedReason) {
      hasChanges = true;
      return newSlot;
    }
    
    return existingSlot;
  });
  
  // Verificar se há novos slots que não existiam
  const existingTimes = new Set(existingSlots.map(s => s.time));
  const newUniqueTimes = newSlots.filter(s => !existingTimes.has(s.time));
  
  if (newUniqueTimes.length > 0) {
    hasChanges = true;
    // Inserir novos slots na posição correta
    const allSlots = [...updatedSlots, ...newUniqueTimes];
    allSlots.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    return allSlots;
  }
  
  return hasChanges ? updatedSlots : null;
}

export function useSlotAvailability(
  selectedDate: Date | undefined,
  serviceDuration: number,
  excludeAppointmentId?: string | null,
  barbeiroId?: string | null,
  tenantId?: string | null
) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  // Inicializa como `true` quando os inputs já estão prontos para evitar
  // que a UI mostre "agenda cheia" no primeiro render antes do fetch iniciar.
  const [loading, setLoading] = useState<boolean>(
    () => Boolean(selectedDate && barbeiroId && serviceDuration > 0)
  );
  const [error, setError] = useState<string | null>(null);
  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Ao mudar data/barbeiro/duração, resetar refs e slots para forçar load completo
  // e evitar que a UI use dados stale do request anterior.
  useEffect(() => {
    isInitialLoadRef.current = true;
    lastSlotsRef.current = [];
    setSlots([]);
    setOccupiedSlots([]);
    if (selectedDate && barbeiroId && serviceDuration > 0) {
      setLoading(true);
    }
  }, [selectedDate, barbeiroId, serviceDuration]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastSlotsRef = useRef<TimeSlot[]>([]);

  /**
   * Função principal que carrega os slots do BACKEND
   * Usa partial updates para evitar re-render completo
   */
  const loadSlots = useCallback(async (forceFullUpdate = false) => {
    if (!selectedDate || serviceDuration <= 0) {
      console.log('[useSlotAvailability] Data ou duração inválida, limpando slots');
      setSlots([]);
      setOccupiedSlots([]);
      lastSlotsRef.current = [];
      isInitialLoadRef.current = true;
      return;
    }

    // Regra crítica: disponibilidade SEMPRE por barbeiro
    if (!barbeiroId) {
      console.log('[useSlotAvailability] Barbeiro não selecionado, não consultar disponibilidade global');
      setSlots([]);
      setOccupiedSlots([]);
      setError(null);
      lastSlotsRef.current = [];
      isInitialLoadRef.current = true;
      return;
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Sempre mostrar loading enquanto busca — evita mensagem "agenda cheia"
    // aparecer durante o carregamento (usando slots vazios/stale).
    setLoading(true);
    setError(null);


    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    console.log('[useSlotAvailability] Buscando slots...', isInitialLoadRef.current ? '(inicial)' : '(update parcial)', barbeiroId ? `barbeiro: ${barbeiroId}` : `tenant: ${tenantId === null ? 'DUB' : (tenantId || 'N/A')}`);

    try {
      // Garantir headers de auth (apikey + Authorization) para evitar 401
      // quando verify_jwt está habilitado na Edge Function.
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const SUPABASE_ANON_KEY = (supabase as any).supabaseKey
        || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdHB6dnVqem1ycnNsaXJ6d3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTUwMTcsImV4cCI6MjA3ODI3MTAxN30.7rWUhWV7d5pdvEjTrnddBzo8gsRZBFrO6JtvDDpksb8';

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/check-availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            date: dateStr,
            duration: serviceDuration,
            excludeAppointmentId: excludeAppointmentId || undefined,
            barbeiroId: barbeiroId || undefined,
            barberId: barbeiroId || undefined, // compatibilidade com versões antigas da Edge Function (camelCase)
            barbeiro_id: barbeiroId || undefined, // compatibilidade com deployments legados (snake_case)
            barber_id: barbeiroId || undefined, // compatibilidade com payload EN legado (snake_case)
            tenantId: tenantId !== undefined ? tenantId : undefined
          }),
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData: AvailabilityResponseEnvelope = await response.json();
      const data = normalizeAvailabilityResponse(rawData);

      if (!data.success) {
        throw new Error(data.message || 'Erro ao verificar disponibilidade');
      }

      // ============================================
      // PARTIAL UPDATE: Atualizar apenas slots que mudaram
      // ============================================
      const responseSlots = data.slots;
      const responseOccupied = data.occupiedSlots;

      if (isInitialLoadRef.current || forceFullUpdate || lastSlotsRef.current.length === 0) {
        // Primeiro load ou força update: substituir tudo
        console.log('[useSlotAvailability] Load completo:', responseSlots.length, 'slots');
        setSlots(responseSlots);
        lastSlotsRef.current = responseSlots;
        isInitialLoadRef.current = false;
      } else {
        // Update parcial: atualizar apenas o que mudou
        const updatedSlots = applyPartialUpdate(lastSlotsRef.current, responseSlots);
        
        if (updatedSlots) {
          // Contar quantos slots mudaram
          let changedCount = 0;
          for (let i = 0; i < Math.min(lastSlotsRef.current.length, updatedSlots.length); i++) {
            if (lastSlotsRef.current[i].available !== updatedSlots[i].available) {
              changedCount++;
            }
          }
          console.log(`[useSlotAvailability] Update parcial: ${changedCount} slot(s) alterado(s)`);
          
          setSlots(updatedSlots);
          lastSlotsRef.current = updatedSlots;
        } else {
          console.log('[useSlotAvailability] Nenhuma mudança detectada');
        }
      }

      setOccupiedSlots(responseOccupied);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[useSlotAvailability] Requisição cancelada');
        return;
      }
      console.error('[useSlotAvailability] ERRO na Edge Function:', err);
      setError('Erro ao carregar horários');
      
      // Fallback: carregar direto do banco se Edge Function falhar
      console.log('[useSlotAvailability] Usando FALLBACK direto do banco...');
      await loadSlotsFromDatabase(dateStr, forceFullUpdate);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, serviceDuration, excludeAppointmentId, barbeiroId, tenantId]);

  /**
   * Fallback CORRIGIDO: carregar slots diretamente do banco
   * Usa as MESMAS regras do backend (intervalo de 10min, delay de 10min)
   * Também usa partial updates para evitar re-render completo
   */
  const loadSlotsFromDatabase = useCallback(async (dateStr: string, forceFullUpdate = false) => {
    try {
      console.log('[useSlotAvailability FALLBACK] Iniciando carregamento direto...');
      
      // CRITICAL: Usar timezone de Brasília (igual ao backend)
      const now = new Date();
      const brasilNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const todayStr = `${brasilNow.getFullYear()}-${String(brasilNow.getMonth() + 1).padStart(2, '0')}-${String(brasilNow.getDate()).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const currentMinutes = brasilNow.getHours() * 60 + brasilNow.getMinutes();
      const minimumAdvanceMinutes = isToday ? currentMinutes + MINIMUM_ADVANCE_MINUTES : 0;

      // Buscar configuração do dia com exceções
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();

      // Prioridade: 1) Exceção barbeiro, 2) Exceção global, 3) Config barbeiro, 4) Config global
      let sourceData: any = null;
      let configSource = 'padrão global';

      // 1) Exceção do barbeiro
      if (barbeiroId) {
        const { data } = await supabase
          .from('horarios_excepcionais_barbeiro')
          .select('*')
          .eq('barbeiro_id', barbeiroId)
          .eq('data', dateStr)
          .maybeSingle();
        if (data) { sourceData = data; configSource = 'EXCEÇÃO BARBEIRO'; }
      }

      // 2) Exceção global
      if (!sourceData) {
        const { data } = await supabase
          .from('horarios_excepcionais')
          .select('*')
          .eq('data', dateStr)
          .maybeSingle();
        if (data) { sourceData = data; configSource = 'EXCEÇÃO GLOBAL'; }
      }

      // 3) Config padrão do barbeiro
      if (!sourceData && barbeiroId) {
        const { data } = await supabase
          .from('configuracoes_horario_barbeiro')
          .select('*')
          .eq('barbeiro_id', barbeiroId)
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();
        // Corrigido: usar data diretamente sem checar aberto !== null (aberto pode ser false válido)
        if (data) { sourceData = data; configSource = 'CONFIG BARBEIRO'; }
      }

      // 4) Config global
      if (!sourceData) {
        const { data } = await supabase
          .from('configuracoes_horario')
          .select('*')
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();
        if (data) { sourceData = data; configSource = 'CONFIG GLOBAL'; }
      }

      const config = sourceData ? {
        aberto: sourceData.aberto ?? true,
        hora_abertura: sourceData.hora_abertura || '09:00',
        hora_fechamento: sourceData.hora_fechamento || '21:00',
        hora_almoco_inicio: sourceData.hora_almoco_inicio,
        hora_almoco_fim: sourceData.hora_almoco_fim,
        delay_entre_servicos: (sourceData as any).delay_entre_servicos || DEFAULT_DELAY_MINUTES
      } : {
        aberto: dayOfWeek !== 0,
        hora_abertura: '09:00',
        hora_fechamento: '21:00',
        hora_almoco_inicio: '13:00',
        hora_almoco_fim: '14:00',
        delay_entre_servicos: DEFAULT_DELAY_MINUTES
      };

      console.log(`[useSlotAvailability FALLBACK] Config do dia ${dayOfWeek}: (${configSource})`, `${config.hora_abertura} - ${config.hora_fechamento}`);

      // CLAMP: Garantir que horário do barbeiro respeite os limites globais
      if (barbeiroId && configSource !== 'CONFIG GLOBAL' && configSource !== 'padrão global') {
        const { data: globalData } = await supabase
          .from('configuracoes_horario')
          .select('*')
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();
        
        if (globalData) {
          if (globalData.aberto === false) {
            config.aberto = false;
            console.log('[useSlotAvailability FALLBACK] CLAMP: Global FECHADO');
          } else if (config.aberto) {
            const globalOpenMin = timeToMinutes(globalData.hora_abertura || '09:00');
            const globalCloseMin = timeToMinutes(globalData.hora_fechamento || '21:00');
            const barberOpenMin = timeToMinutes(config.hora_abertura);
            const barberCloseMin = timeToMinutes(config.hora_fechamento);
            if (barberOpenMin < globalOpenMin) {
              console.log(`[useSlotAvailability FALLBACK] CLAMP: Abertura ${config.hora_abertura} → ${globalData.hora_abertura}`);
              config.hora_abertura = globalData.hora_abertura || '09:00';
            }
            if (barberCloseMin > globalCloseMin) {
              console.log(`[useSlotAvailability FALLBACK] CLAMP: Fechamento ${config.hora_fechamento} → ${globalData.hora_fechamento}`);
              config.hora_fechamento = globalData.hora_fechamento || '21:00';
            }
          }
        }
      }

      if (!config.aberto) {
        console.log('[useSlotAvailability FALLBACK] Dia fechado');
        setSlots([]);
        setOccupiedSlots([]);
        lastSlotsRef.current = [];
        return;
      }

      const OPEN_MINUTES = timeToMinutes(config.hora_abertura);
      const CLOSE_MINUTES = timeToMinutes(config.hora_fechamento);
      const LUNCH_START = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
      const LUNCH_END = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;
      const LUNCH_BUFFER_MINUTES = 10;
      const LUNCH_END_WITH_BUFFER = LUNCH_END !== null ? LUNCH_END + LUNCH_BUFFER_MINUTES : null;
      const DELAY_MINUTES = config.delay_entre_servicos || DEFAULT_DELAY_MINUTES;

      // Buscar agendamentos com status bloqueante (filtrado por barbeiro/tenant)
      let scopedBarberIds: string[] = [];
      if (!barbeiroId && tenantId !== undefined) {
        let barbersQuery = supabase
          .from('barbeiros')
          .select('id')
          .eq('ativo', true);

        if (tenantId === null) {
          barbersQuery = barbersQuery.is('tenant_id', null);
        } else {
          barbersQuery = barbersQuery.eq('tenant_id', tenantId);
        }

        const { data: scopedBarbers } = await barbersQuery;
        scopedBarberIds = (scopedBarbers || []).map((b: { id: string }) => b.id);
      }

      let aptQuery = supabase
        .from('agendamentos')
        .select('id, hora, duracao, status')
        .eq('data', dateStr)
        .in('status', ['pending', 'confirmed', 'completed']);

      if (barbeiroId) {
        aptQuery = aptQuery.eq('barbeiro_id', barbeiroId);
      } else if (tenantId !== undefined) {
        if (scopedBarberIds.length > 0) {
          aptQuery = aptQuery.in('barbeiro_id', scopedBarberIds);
        } else {
          aptQuery = aptQuery.eq('id', '__no_rows__');
        }
      }

      const { data: appointments, error: aptError } = await aptQuery;

      if (aptError) throw aptError;

      // Buscar pending_bookings não expirados (filtrado por barbeiro/tenant)
      let pbQuery = supabase
        .from('pending_bookings')
        .select('id, hora, duracao, expires_at')
        .eq('data', dateStr)
        .gt('expires_at', now.toISOString());

      if (barbeiroId) {
        pbQuery = pbQuery.eq('barbeiro_id', barbeiroId);
      } else if (tenantId !== undefined) {
        if (scopedBarberIds.length > 0) {
          pbQuery = pbQuery.in('barbeiro_id', scopedBarberIds);
        } else {
          pbQuery = pbQuery.eq('id', '__no_rows__');
        }
      }

      const { data: pendingBookings } = await pbQuery;

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

      // Gerar slots a cada 10 minutos (igual ao backend)
      const generatedSlots: TimeSlot[] = [];

      for (let slotStartMinutes = OPEN_MINUTES; slotStartMinutes < CLOSE_MINUTES; slotStartMinutes += SLOT_INTERVAL) {
        const timeStr = minutesToTime(slotStartMinutes);
        const slotEndMinutes = slotStartMinutes + serviceDuration;

        // 1. Verificar se cabe antes do fechamento
        if (slotEndMinutes > CLOSE_MINUTES) continue;

        // 2. Verificar almoço - sobreposição: slotStart < LUNCH_END E slotEnd > LUNCH_START
        if (LUNCH_START !== null && LUNCH_END_WITH_BUFFER !== null) {
          if (slotStartMinutes < LUNCH_END_WITH_BUFFER && slotEndMinutes > LUNCH_START) continue;
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

      // ============================================
      // PARTIAL UPDATE: Atualizar apenas slots que mudaram
      // ============================================
      if (isInitialLoadRef.current || forceFullUpdate || lastSlotsRef.current.length === 0) {
        console.log('[useSlotAvailability FALLBACK] Load completo:', generatedSlots.length, 'slots');
        setSlots(generatedSlots);
        lastSlotsRef.current = generatedSlots;
        isInitialLoadRef.current = false;
      } else {
        const updatedSlots = applyPartialUpdate(lastSlotsRef.current, generatedSlots);
        if (updatedSlots) {
          console.log('[useSlotAvailability FALLBACK] Update parcial aplicado');
          setSlots(updatedSlots);
          lastSlotsRef.current = updatedSlots;
        }
      }

      setOccupiedSlots(allOccupied);

    } catch (err) {
      console.error('[useSlotAvailability FALLBACK] Erro:', err);
      setError('Erro ao carregar horários');
    }
  }, [serviceDuration, barbeiroId, tenantId]);

  /**
   * Configurar listeners em tempo real e polling
   * Usa partial updates para evitar scroll jump
   */
  useEffect(() => {
    if (!selectedDate || serviceDuration <= 0 || !barbeiroId) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Reset initial load flag quando data muda
    isInitialLoadRef.current = true;
    lastSlotsRef.current = [];

    // Limpar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Limpar polling anterior
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Carregar slots inicialmente (full load)
    loadSlots(true);

    // Configurar canal de realtime - usa partial updates
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
          console.log('[Realtime] Mudança em agendamentos:', payload.eventType, '(partial update)');
          // Partial update - não força reload completo
          loadSlots(false);
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
          console.log('[Realtime] Mudança em pending_bookings:', payload.eventType, '(partial update)');
          // Partial update - não força reload completo
          loadSlots(false);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status do canal:`, status);
      });

    channelRef.current = channel;

    // Polling de backup (a cada 10 segundos) - usa partial updates
    pollIntervalRef.current = setInterval(() => {
      loadSlots(false);
    }, 10000);

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
  }, [selectedDate, serviceDuration, barbeiroId, loadSlots]);

  /**
   * Função para forçar recarga completa dos slots
   * Usado quando o usuário quer atualizar manualmente
   */
  const refreshSlots = useCallback(() => {
    loadSlots(true);
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

    if (!barbeiroId) {
      return { available: false, message: 'Selecione um profissional antes de continuar.' };
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const slotStartMinutes = timeToMinutes(time);
    const slotEndMinutes = slotStartMinutes + serviceDuration;

    console.log(`[verifySlotAvailability] Verificando ${dateStr} ${time} (${minutesToTime(slotStartMinutes)}-${minutesToTime(slotEndMinutes)})`);

    try {
      // Buscar configuração do dia para pegar o delay (hierarquia: barbeiro > global)
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();

      let delayConfig: any = null;

      // Config do barbeiro primeiro
      if (barbeiroId) {
        const { data } = await supabase
          .from('configuracoes_horario_barbeiro')
          .select('delay_entre_servicos')
          .eq('barbeiro_id', barbeiroId)
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();
        if (data) delayConfig = data;
      }

      // Fallback para config global
      if (!delayConfig) {
        const { data } = await supabase
          .from('configuracoes_horario')
          .select('delay_entre_servicos')
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();
        if (data) delayConfig = data;
      }

      const DELAY_MINUTES = delayConfig?.delay_entre_servicos || DEFAULT_DELAY_MINUTES;

      // Buscar agendamentos com status bloqueante (filtrado por barbeiro)
      let query = supabase
        .from('agendamentos')
        .select('id, hora, duracao, status')
        .eq('data', dateStr)
        .in('status', ['pending', 'confirmed', 'completed']);

      if (barbeiroId) {
        query = query.eq('barbeiro_id', barbeiroId);
      }

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

      // Verificar pending_bookings (filtrado por barbeiro)
      let pbQuery2 = supabase
        .from('pending_bookings')
        .select('id, hora, duracao')
        .eq('data', dateStr)
        .gt('expires_at', new Date().toISOString());
      if (barbeiroId) pbQuery2 = pbQuery2.eq('barbeiro_id', barbeiroId);

      const { data: pendingBookings } = await pbQuery2;

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
  }, [selectedDate, serviceDuration, excludeAppointmentId, barbeiroId]);

  // ============================================
  // FILTRO CLIENT-SIDE DE ANTECEDÊNCIA MÍNIMA
  // Re-renderiza a cada 30s para que horários passados sumam em tempo real
  // (independente da latência do backend/polling).
  // ============================================
  const enforcedSlots = (() => {
    if (!selectedDate) return slots;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const brasilNow = new Date(new Date(nowTick).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayStr = `${brasilNow.getFullYear()}-${String(brasilNow.getMonth() + 1).padStart(2, '0')}-${String(brasilNow.getDate()).padStart(2, '0')}`;
    if (dateStr !== todayStr) return slots;
    const currentMinutes = brasilNow.getHours() * 60 + brasilNow.getMinutes();
    const minMinutes = currentMinutes + MINIMUM_ADVANCE_MINUTES;
    return slots.map(s =>
      s.available && timeToMinutes(s.time) < minMinutes
        ? { ...s, available: false, blockedReason: 'minimum_advance' as const }
        : s
    );
  })();

  return {
    slots: enforcedSlots,
    loading,
    error,
    occupiedSlots,
    refreshSlots,
    verifySlotAvailability
  };
}

