'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import { useDividas } from '@/hooks/useDividas';
import { DebtPaymentModal } from '@/components/DebtPaymentModal';

/**
 * Gate centralizado de pendência financeira por taxa de cancelamento.
 * Exibe a tela de dívida com o aviso claro e opção direta de "Pagar agora" via PIX (split 50/50).
 */
export function CancellationDebtGate() {
  const { user } = useAuth();
  const { pendingDebt, hasDebt, refresh } = useDividas(user?.id);
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasAutoOpened = useRef(false);

  // Não exibe se o cliente já estiver no fluxo de pagamento ou carteira
  const isExcludedRoute =
    location.pathname.startsWith('/cliente/carteira') ||
    location.pathname.startsWith('/cliente/pagamento') ||
    location.pathname.startsWith('/cliente/pix-checkout') ||
    location.pathname.startsWith('/cliente/subscription-pix') ||
    location.pathname.startsWith('/cliente/assinar');

  // Abre automaticamente quando identifica dívida pendente
  useEffect(() => {
    if (hasDebt && !dismissed && !isExcludedRoute && !hasAutoOpened.current) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        hasAutoOpened.current = true;
      }, 450);
      return () => clearTimeout(timer);
    }

    if (!hasDebt) {
      setIsOpen(false);
    }
  }, [hasDebt, dismissed, isExcludedRoute]);

  if (!hasDebt || isExcludedRoute) {
    return null;
  }

  const handleOpenChange = (openState: boolean) => {
    setIsOpen(openState);
    if (!openState) {
      setDismissed(true);
    }
  };

  const handlePaymentSuccess = () => {
    setIsOpen(false);
    refresh();
  };

  return (
    <DebtPaymentModal
      open={isOpen}
      onOpenChange={handleOpenChange}
      divida={pendingDebt}
      onPaymentSuccess={handlePaymentSuccess}
    />
  );
}

export default CancellationDebtGate;