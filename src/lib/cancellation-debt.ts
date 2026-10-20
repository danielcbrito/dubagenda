export interface CancellationDebtItem {
  id: string;
  agendamento_id?: string;
  barbeiro_id?: string;
  barbeiro_nome?: string;
  motivo?: 'cancelamento_tardio' | 'falta' | string;
  valor_taxa: number;
  tipo_taxa?: 'porcentagem' | 'fixo' | string;
  porcentagem_aplicada?: number | null;
  valor_servico_original?: number;
  status: string; // 'pendente' | 'pago' | 'dispensado' | 'liberado_manual'
  created_at?: string;
  paid_at?: string;
  correlation_id?: string;
  tenant_id?: string;
}

export interface CancellationDebt {
  row_id: number;
  tenant_id: string;
  debito: {
    id: string;
    cliente_id: string;
    cliente_nome?: string;
    cliente_telefone?: string;
    barbeiro_id?: string;
    agendamento_id?: string;
    valor_taxa: number;
    total_pendente?: number;
    status: string;
    itens?: CancellationDebtItem[];
  };
}

export function readPendingDebts(value: unknown, userId: string): CancellationDebt[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is CancellationDebt => {
    if (!row?.tenant_id || !row?.debito?.id) return false;
    const deb = row.debito;
    if (deb.cliente_id !== userId) return false;
    const isPendingStatus = deb.status === 'pendente';
    const totalPendente = Number(deb.total_pendente);
    const valorTaxa = Number(deb.valor_taxa);
    const hasPositivePending = (Number.isFinite(totalPendente) && totalPendente > 0) || (Number.isFinite(valorTaxa) && valorTaxa > 0);
    return isPendingStatus && hasPositivePending;
  });
}

/**
 * Retorna o valor total somado de todas as dívidas e taxas pendentes do cliente.
 */
export function getPendingDebtTotal(debts: CancellationDebt[]): number {
  return debts.reduce((sum, d) => {
    const deb = d.debito;
    if (!deb || deb.status !== 'pendente') return sum;
    if (typeof deb.total_pendente === 'number' && Number.isFinite(deb.total_pendente) && deb.total_pendente > 0) {
      return sum + deb.total_pendente;
    }
    if (Array.isArray(deb.itens) && deb.itens.length > 0) {
      const itemsSum = deb.itens
        .filter(item => item.status === 'pendente' && Number.isFinite(item.valor_taxa) && item.valor_taxa > 0)
        .reduce((s, item) => s + item.valor_taxa, 0);
      return sum + itemsSum;
    }
    if (Number.isFinite(deb.valor_taxa) && deb.valor_taxa > 0) {
      return sum + deb.valor_taxa;
    }
    return sum;
  }, 0);
}

/**
 * Retorna a lista detalhada de cada taxa pendente individualmente para exibição na carteira e no resumo.
 */
export function getPendingDebtItems(debts: CancellationDebt[]): CancellationDebtItem[] {
  const items: CancellationDebtItem[] = [];
  for (const d of debts) {
    const deb = d.debito;
    if (!deb || deb.status !== 'pendente') continue;
    if (Array.isArray(deb.itens) && deb.itens.length > 0) {
      for (const item of deb.itens) {
        if (item.status === 'pendente' && Number.isFinite(item.valor_taxa) && item.valor_taxa > 0) {
          items.push(item);
        }
      }
    } else if (Number.isFinite(deb.valor_taxa) && deb.valor_taxa > 0) {
      items.push({
        id: deb.id,
        agendamento_id: deb.agendamento_id,
        barbeiro_id: deb.barbeiro_id,
        motivo: 'cancelamento_tardio',
        valor_taxa: deb.valor_taxa,
        status: deb.status,
      });
    }
  }
  return items;
}

type DebtEvent = { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> };

/** Apply authoritative release events only to the matching debt; never clear other tenants' debts. */
export function applyDebtRelease(debts: CancellationDebt[], event: DebtEvent, userId: string): CancellationDebt[] {
  if (event.eventType === 'DELETE') {
    return debts.filter(debt => debt.row_id !== event.old?.id);
  }
  if (event.eventType !== 'UPDATE') return debts;
  const row = event.new;
  if (!row || row.chave !== `debito_cancelamento_${userId}` || row.categoria !== 'debitos_cliente' || typeof row.valor !== 'string') return debts;
  try {
    const parsed = JSON.parse(row.valor);
    if (parsed?.cliente_id !== userId) return debts;
    if (['pago', 'dispensado', 'liberado_manual'].includes(parsed?.status) || (parsed?.total_pendente === 0)) {
      return debts.filter(debt => !(debt.row_id === row.id && debt.tenant_id === row.tenant_id));
    }
    // Se ainda está pendente mas atualizou itens/valores, reflete o novo débito
    return debts.map(debt => {
      if (debt.row_id === row.id && debt.tenant_id === row.tenant_id) {
        return {
          row_id: row.id as number,
          tenant_id: row.tenant_id as string,
          debito: parsed,
        };
      }
      return debt;
    });
  } catch { return debts; }
}