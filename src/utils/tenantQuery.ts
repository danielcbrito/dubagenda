import { supabase } from "@/integrations/supabase/client";

/**
 * Constrói uma query de barbeiros filtrada por tenant/unidade.
 * Centraliza o tratamento do legado (tenant_id IS NULL = DUB global).
 *
 * @param tenantId - ID do tenant. null = DUB global (legado).
 * @param unidadeId - Opcional. Filtra por unidade específica.
 */
export function buildBarberQuery(tenantId: string | null, unidadeId?: string | null) {
  let query = supabase
    .from("barbeiros")
    .select("id, apelido, foto_url, tenant_id, unidade_id")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("apelido");

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  } else {
    // Legado DUB: barbeiros sem tenant_id associado
    query = query.is("tenant_id", null);
  }

  if (unidadeId) {
    query = query.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);
  }

  return query;
}

/**
 * Aplica filtro de tenant a uma query existente.
 * Centraliza o tratamento do legado (tenant_id IS NULL = DUB global).
 *
 * @param query - Query Supabase existente.
 * @param tenantId - ID do tenant. null = DUB global (legado).
 */
export function applyTenantFilter<T>(query: T, tenantId: string | null): T {
  if (tenantId) {
    return (query as any).eq("tenant_id", tenantId);
  }
  return (query as any).is("tenant_id", null);
}
