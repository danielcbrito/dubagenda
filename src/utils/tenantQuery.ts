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
 * Constrói uma query genérica filtrada por tenant.
 * Centraliza o tratamento do legado (tenant_id IS NULL = DUB global).
 *
 * @param table - Nome da tabela Supabase.
 * @param tenantId - ID do tenant. null = DUB global (legado).
 * @param selectColumns - Colunas para selecionar (padrão: "*").
 */
export function buildTenantQuery(
  table: string,
  tenantId: string | null,
  selectColumns = "*"
) {
  let query = supabase.from(table).select(selectColumns);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  } else {
    query = query.is("tenant_id", null);
  }

  return query;
}
