export interface CancellationDebt {
  row_id: number;
  tenant_id: string;
  debito: { id: string; cliente_id: string; cliente_nome?: string; cliente_telefone?: string; barbeiro_id: string; agendamento_id: string; valor_taxa: number; status: string };
}

export function readPendingDebts(value: unknown, userId: string): CancellationDebt[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is CancellationDebt => Boolean(row?.tenant_id && row?.debito?.id && row.debito.cliente_id === userId && row.debito.status === 'pendente' && Number.isFinite(row.debito.valor_taxa) && row.debito.valor_taxa > 0));
}

type DebtEvent = { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> };

/** Apply authoritative release events only to the matching debt; never clear other tenants' debts. */
export function applyDebtRelease(debts: CancellationDebt[], event: DebtEvent, userId: string): CancellationDebt[] {
  if (event.eventType === 'DELETE') {
    // RLS-enabled DELETE events may contain only the primary key.
    return debts.filter(debt => debt.row_id !== event.old?.id);
  }
  if (event.eventType !== 'UPDATE') return debts;
  const row = event.new;
  if (!row || row.chave !== `debito_cancelamento_${userId}` || row.categoria !== 'debitos_cliente' || typeof row.valor !== 'string') return debts;
  try {
    const parsed = JSON.parse(row.valor);
    if (parsed?.cliente_id !== userId || !['pago', 'dispensado', 'liberado_manual'].includes(parsed?.status)) return debts;
    return debts.filter(debt => !(debt.row_id === row.id && debt.tenant_id === row.tenant_id));
  } catch { return debts; }
}