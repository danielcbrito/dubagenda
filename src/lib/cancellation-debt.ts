export interface CancellationDebt {
  row_id: number;
  tenant_id: string;
  debito: { id: string; cliente_id: string; barbeiro_id: string; agendamento_id: string; valor_taxa: number; status: string };
}

export function readPendingDebts(value: unknown, userId: string): CancellationDebt[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is CancellationDebt => Boolean(row?.tenant_id && row?.debito?.id && row.debito.cliente_id === userId && row.debito.status === 'pendente' && Number.isFinite(row.debito.valor_taxa) && row.debito.valor_taxa > 0));
}