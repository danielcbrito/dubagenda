import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight } from "lucide-react";

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
 * Compactado para economizar espaço e mais direto.
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
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={true}>
      <DrawerContent className="px-4 pb-6 outline-none border-none bg-background shadow-2xl max-w-sm mx-auto rounded-t-3xl">
        <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/15 mt-3 mb-1" />
        
        <DrawerHeader className="px-0 pt-2 pb-0">
          <div className="mx-auto mb-3">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <DrawerTitle className="text-center text-lg font-bold tracking-tight">Assinatura Pendente</DrawerTitle>
          <DrawerDescription className="text-center text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-[240px] mx-auto">
            Finalize o pagamento do <span className="font-bold text-foreground">{planName}</span> para ativar seus benefícios.
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex flex-col gap-2 mt-5">
          <Button 
            onClick={onFinalize} 
            className="w-full h-11 text-[13px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md shadow-primary/10 transition-all active:scale-[0.98]"
          >
            Finalizar Pagamento
            <ArrowRight className="ml-1.5 w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={onCancel}
            disabled={isCanceling}
            className="w-full h-10 text-[12px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
          >
            {isCanceling ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Cancelando...
              </span>
            ) : (
              "Desistir e cancelar"
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
