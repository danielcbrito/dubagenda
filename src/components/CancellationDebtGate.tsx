import { useState } from 'react';
import { AlertCircle, ChevronRight, X, Wallet } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import { useCancellationDebt } from '@/hooks/useCancellationDebt';
import { getPendingDebtTotal } from '@/lib/cancellation-debt';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Banner informativo não-bloqueante sobre dívidas de cancelamento/falta.
 * Não bloqueia a tela; apenas informa o cliente de forma elegante que o valor
 * será somado ao próximo agendamento ou pode ser pago na carteira.
 */
export function CancellationDebtGate() {
  const { user } = useAuth();
  const { debts } = useCancellationDebt(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Não exibe se o usuário estiver na própria carteira ou no agendamento (onde o resumo já exibe)
  const isExcludedRoute =
    location.pathname.startsWith('/cliente/carteira') ||
    location.pathname.startsWith('/cliente/agendar');

  const totalPendente = getPendingDebtTotal(debts);

  if (dismissed || isExcludedRoute || totalPendente <= 0) {
    return null;
  }

  const formattedTotal = totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        aria-label="Aviso de taxa pendente"
        className="fixed top-0 left-0 right-0 z-[40] bg-amber-500 text-amber-950 px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs font-medium"
      >
        <button
          onClick={() => navigate('/cliente/carteira')}
          className="flex-1 flex items-center gap-2 text-left truncate hover:opacity-90 transition-opacity"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-950" />
          <span className="truncate">
            Você tem <strong>{formattedTotal}</strong> em taxa pendente (será somada no seu próximo agendamento).
          </span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-amber-600/20 active:scale-95 transition-colors"
          aria-label="Fechar aviso de taxa pendente"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.aside>
    </AnimatePresence>
  );
}