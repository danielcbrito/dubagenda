import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthProvider';
import { useCancellationDebt } from '@/hooks/useCancellationDebt';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Pix = { br_code: string; qr_code_image?: string; expires_at?: string };

export function CancellationDebtGate() {
  const { user } = useAuth();
  const { debts, refresh } = useCancellationDebt(user?.id);
  const debt = debts[0];
  const [pix, setPix] = useState<{ id: string; data: Pix } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!debt) return;
    let disposed = false;
    const timer = window.setInterval(async () => {
      const { data } = await supabase.functions.invoke('cancellation-debt', { body: { action: 'status', rowId: debt.row_id } });
      if (!disposed && data?.paid) refresh();
    }, 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [debt?.row_id, refresh]);

  const generatePix = async () => {
    if (!debt || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: requestError } = await supabase.functions.invoke('cancellation-debt', { body: { action: 'create', rowId: debt.row_id } });
      if (requestError) {
        const detail = await requestError.context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? 'Não foi possível gerar o PIX. Tente novamente.');
      }
      if (data?.error) throw new Error(data.error);
      if (data?.paid) { refresh(); return; }
      if (!data?.br_code) throw new Error('PIX indisponível.');
      setPix({ id: debt.debito.id, data });
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível gerar o PIX.'); }
    finally { setBusy(false); }
  };
  if (!debt) return null;
  const currentPix = pix?.id === debt.debito.id ? pix.data : null;
  // O backdrop também cobre portais e controles que estejam fora do layout.
  return createPortal(<>
    <div className="fixed inset-0 z-[9998] bg-background" />
    <Dialog open>
      <DialogContent className="fixed inset-0 z-[9999] m-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-background p-6 flex flex-col items-center justify-center overflow-y-auto overscroll-contain [&>button]:hidden"
        onEscapeKeyDown={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
        <div className="w-full max-w-sm space-y-6 text-center">
          <DialogTitle className="text-xl font-semibold text-foreground">Aplicativo temporariamente bloqueado.</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">Você possui uma taxa de cancelamento pendente.</DialogDescription>
          <p className="text-3xl font-semibold tabular-nums text-foreground">{debt.debito.valor_taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          {currentPix?.qr_code_image && <img src={currentPix.qr_code_image} alt="QR Code PIX da taxa de cancelamento" className="w-60 h-60 object-contain mx-auto bg-card" />}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full min-h-12 text-base" disabled={busy} onClick={generatePix}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : currentPix ? 'Atualizar QR Code PIX' : 'Gerar QR Code PIX'}
          </Button>
          {currentPix && <Button variant="outline" className="w-full min-h-12 whitespace-normal text-base" onClick={async () => {
            try { await navigator.clipboard.writeText(currentPix.br_code); toast.success('Código PIX copiado.'); }
            catch { setError('Não foi possível copiar. Selecione o código abaixo.'); }
          }}>Copiar código Pix Copia e Cola</Button>}
          {currentPix && <textarea readOnly aria-label="Código PIX Copia e Cola" value={currentPix.br_code} className="w-full h-20 resize-none rounded-md border border-border bg-muted p-3 text-xs text-foreground" />}
        </div>
      </DialogContent>
    </Dialog>
  </>, document.body);
}