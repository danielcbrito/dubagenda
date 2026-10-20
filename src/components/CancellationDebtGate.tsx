import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Wallet, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthProvider';
import { useCancellationDebt } from '@/hooks/useCancellationDebt';
import { getPendingDebtTotal } from '@/lib/cancellation-debt';

/**
 * Notificação centralizada no meio da tela para pendências financeiras.
 * Alinhada estritamente às diretrizes de UX e feedback do usuário:
 * - Exibida no meio da tela (Dialog modal) ao entrar no aplicativo.
 * - Sóbria, limpa e sem exibição de valores monetários.
 * - Botão direto de alta conversão para redirecionar o cliente à Carteira, onde tudo é consultado e pago.
 */
export function CancellationDebtGate() {
  const { user } = useAuth();
  const { debts } = useCancellationDebt(user?.id);
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasAutoOpened = useRef(false);

  // Não exibe se o cliente já estiver na carteira ou em fluxos imersivos de agendamento/checkout
  const isExcludedRoute =
    location.pathname.startsWith('/cliente/carteira') ||
    location.pathname.startsWith('/cliente/agendar') ||
    location.pathname.startsWith('/cliente/pagamento') ||
    location.pathname.startsWith('/cliente/pix-checkout') ||
    location.pathname.startsWith('/cliente/subscription-pix') ||
    location.pathname.startsWith('/cliente/assinar');

  const totalPendente = getPendingDebtTotal(debts);

  // Exibição automática no meio da tela ao entrar no app com pendência
  useEffect(() => {
    if (totalPendente > 0 && !dismissed && !isExcludedRoute && !hasAutoOpened.current) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        hasAutoOpened.current = true;
      }, 450);
      return () => clearTimeout(timer);
    }

    if (totalPendente === 0) {
      setIsOpen(false);
    }
  }, [totalPendente, dismissed, isExcludedRoute]);

  if (totalPendente <= 0 || isExcludedRoute) {
    return null;
  }

  const handleOpenChange = (openState: boolean) => {
    setIsOpen(openState);
    if (!openState) {
      setDismissed(true);
    }
  };

  const handleGoToWallet = () => {
    setIsOpen(false);
    setDismissed(true);
    navigate('/cliente/carteira');
  };

  const handleClose = () => {
    setIsOpen(false);
    setDismissed(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px] w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-border/60 bg-background/95 backdrop-blur-xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-center [&>button]:top-4 [&>button]:right-4">
        {/* Ícone de Alerta Sutil no Topo */}
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <AlertCircle className="w-6 h-6" />
        </div>

        <DialogHeader className="px-0 pb-1 text-center space-y-1.5">
          <DialogTitle className="text-center text-lg font-bold tracking-tight text-foreground">
            Pendência financeira
          </DialogTitle>

          <DialogDescription className="text-center text-[13px] text-muted-foreground leading-relaxed max-w-[270px] mx-auto">
            Identificamos uma taxa pendente na sua conta. Acesse sua carteira para conferir os detalhes e regularizar.
          </DialogDescription>
        </DialogHeader>

        {/* Ações Diretas */}
        <div className="flex flex-col gap-2 pt-3">
          <Button
            onClick={handleGoToWallet}
            className="w-full h-11 text-[13px] font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            Acessar carteira
            <ArrowRight className="w-4 h-4 ml-0.5 opacity-70" />
          </Button>

          <Button
            variant="ghost"
            onClick={handleClose}
            className="w-full h-9 text-[12px] font-medium text-muted-foreground hover:text-foreground rounded-xl transition-colors"
          >
            Ver mais tarde
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CancellationDebtGate;