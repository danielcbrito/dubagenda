import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Clock, XCircle, ArrowRight } from "lucide-react";

interface PendingSubscriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  onFinalize: () => void;
  onCancel: () => void;
  isCanceling?: boolean;
}

/**
 * Drawer estratégico para assinaturas pendentes.
 * Substitui o banner antigo por uma abordagem mais imersiva e direta.
 */
export function PendingSubscriptionDrawer({
  open,
  onOpenChange,
  planName,
  onFinalize,
  onCancel,
  isCanceling = false,
}: PendingSubscriptionDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DrawerContent className="px-4 pb-8 outline-none border-none bg-background shadow-2xl">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 mt-3 mb-2" />
        
        <DrawerHeader className="px-0 pt-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 rotate-3">
            <Clock className="w-7 h-7 text-primary -rotate-3" />
          </div>
          <DrawerTitle className="text-center text-xl font-bold tracking-tight">Assinatura Pendente</DrawerTitle>
          <DrawerDescription className="text-center text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[280px] mx-auto">
            Você iniciou a assinatura do <span className="font-bold text-foreground">{planName}</span>. 
            Finalize o pagamento para ativar seus benefícios agora mesmo.
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex flex-col gap-3 mt-6">
          <Button 
            onClick={onFinalize} 
            className="w-full h-13 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            Finalizar Pagamento
            <ArrowRight className="ml-2 w-4.5 h-4.5" />
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={onCancel}
            disabled={isCanceling}
            className="w-full h-12 text-[13px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-2xl transition-colors"
          >
            {isCanceling ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Cancelando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4 opacity-70" />
                Desistir e cancelar
              </span>
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
