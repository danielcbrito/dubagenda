import { supabase } from "@/integrations/supabase/client";
import { getCache, setCache } from "@/utils/cache";

/**
 * Cache + prefetch dos dados da tela de agendamento.
 *
 * Objetivo: ao tocar em "Agendar", a lista de profissionais aparece
 * INSTANTANEAMENTE (dado do sessionStorage) e a revalidação acontece atrás.
 */

export interface CachedBarber {
  id: string;
  apelido: string;
  foto_url: string | null;
  tenant_id?: string | null;
  unidade_id?: string | null;
}

export interface CachedService {
  id: string;
  nome: string;
  descricao: string;
  duracao_minutos: number;
  preco: number;
  [key: string]: unknown;
}

export interface CachedUnit {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_sede: boolean | null;
}

export interface BookingContext {
  tenantId: string | null;
  unitId: string | null;
  hasPlan: boolean;
}

const TTL_MIN = 15;

const CTX_KEY = "booking:ctx";
const barbersKey = (tenantId: string | null, unitId: string | null) =>
  `booking:barbers:${tenantId ?? "dub"}:${unitId ?? "all"}`;
const allBarbersKey = () => "booking:barbers:all";
const servicesKey = (tenantId: string | null) => `booking:services:${tenantId ?? "dub"}`;
const unitsKey = (tenantId: string | null) => `booking:units:${tenantId ?? "dub"}`;

/** Contexto (tenant/unidade/plano) salvo da última visita — leitura síncrona. */
export function getBookingContext(): BookingContext | null {
  return getCache<BookingContext>(CTX_KEY);
}

export function setBookingContext(ctx: BookingContext) {
  setCache(CTX_KEY, ctx, 60);
}

/** Leitura síncrona de tudo que já está em cache para o contexto informado. */
export function getCachedBookingData(tenantId: string | null, unitId: string | null) {
  return {
    barbers: getCache<CachedBarber[]>(barbersKey(tenantId, unitId)),
    allBarbers: getCache<CachedBarber[]>(allBarbersKey()),
    services: getCache<CachedService[]>(servicesKey(tenantId)),
    units: getCache<CachedUnit[]>(unitsKey(tenantId)),
  };
}

export async function fetchBarbers(tenantId: string | null, unitId: string | null) {
  let query = supabase
    .from("barbeiros")
    .select("id, apelido, foto_url, tenant_id, unidade_id")
    .eq("ativo", true)
    .order("apelido");

  if (tenantId) query = query.eq("tenant_id", tenantId);
  else query = query.is("tenant_id", null);

  if (unitId) query = query.or(`unidade_id.eq.${unitId},unidade_id.is.null`);

  const allQuery = supabase
    .from("barbeiros")
    .select("id, apelido, foto_url, tenant_id, unidade_id")
    .eq("ativo", true)
    .order("apelido");

  const [filtered, all] = await Promise.all([query, allQuery]);

  const filteredList = (filtered.data || []) as CachedBarber[];
  const allList = (all.data || []) as CachedBarber[];

  setCache(barbersKey(tenantId, unitId), filteredList, TTL_MIN);
  setCache(allBarbersKey(), allList, TTL_MIN);

  return { filtered: filteredList, all: allList };
}

export async function fetchServices(tenantId: string | null) {
  let query = supabase.from("servicos").select("*").eq("ativo", true).order("preco");
  if (tenantId) query = query.eq("tenant_id", tenantId);
  else query = query.is("tenant_id", null);

  const { data } = await query;
  const list = (data || []) as CachedService[];
  setCache(servicesKey(tenantId), list, TTL_MIN);
  return list;
}

export async function fetchUnits(tenantId: string) {
  const { data } = await supabase
    .from("tenant_unidades")
    .select("id, nome, bairro, cidade, estado, is_sede")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("is_sede", { ascending: false });

  const list = (data || []) as CachedUnit[];
  setCache(unitsKey(tenantId), list, TTL_MIN);
  return list;
}

let prefetching = false;

/**
 * Aquece o cache do agendamento em background (chamado da Home do cliente).
 * Roda em idle e nunca lança.
 */
export function prefetchBookingData(userId: string | null) {
  if (!userId || prefetching || typeof window === "undefined") return;
  prefetching = true;

  const run = async () => {
    try {
      const [{ data: profile }, { data: subs }] = await Promise.all([
        supabase
          .from("profiles")
          .select("barbearia_preferida_id, unidade_preferida_id")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("assinaturas")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .limit(1),
      ]);

      const tenantId = (profile as any)?.barbearia_preferida_id ?? null;
      const preferredUnitId = (profile as any)?.unidade_preferida_id ?? null;

      let unitId: string | null = null;
      if (tenantId) {
        const units = await fetchUnits(tenantId);
        if (preferredUnitId && units.some((u) => u.id === preferredUnitId)) {
          unitId = preferredUnitId;
        }
      }

      setBookingContext({ tenantId, unitId, hasPlan: (subs?.length ?? 0) > 0 });

      await Promise.all([fetchBarbers(tenantId, unitId), fetchServices(tenantId)]);
    } catch {
      /* prefetch é best-effort */
    } finally {
      prefetching = false;
    }
  };

  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;

  if (ric) ric(() => void run(), { timeout: 2500 });
  else window.setTimeout(() => void run(), 600);
}
