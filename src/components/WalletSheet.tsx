import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Wallet, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface WalletSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

interface Credit {
  id: string;
  valor: number;
  origem: string;
  usado: boolean;
  created_at: string;
  expires_at: string | null;
  agendamento_origem_id: string | null;
}

export function WalletSheet({ open, onOpenChange, userId }: WalletSheetProps) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      loadCredits();
    }
  }, [open, userId]);

  const loadCredits = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Get all credits
      const { data: creditsData, error: creditsError } = await supabase
        .from("creditos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (creditsError) throw creditsError;
      
      setCredits(creditsData || []);

      // Get available balance
      const { data: balanceData, error: balanceError } = await supabase
        .rpc("get_user_available_credits", { p_user_id: userId });

      if (balanceError) throw balanceError;
      
      setAvailableBalance(balanceData || 0);
    } catch (error) {
      console.error("Error loading credits:", error);
    } finally {
      setLoading(false);
    }
  };

  const getOriginLabel = (origem: string) => {
    switch (origem) {
      case "cancelamento":
        return "Cancelamento de agendamento";
      case "reembolso":
        return "Reembolso";
      case "promocao":
        return "Promoção";
      default:
        return origem;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Minha Carteira
          </SheetTitle>
          <SheetDescription>
            Gerencie seus créditos e histórico
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Available Balance Card */}
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Créditos Disponíveis</p>
              <p className="text-4xl font-bold text-primary">
                R$ {availableBalance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Pode ser usado em qualquer agendamento
              </p>
            </div>
          </Card>

          {/* Credits History */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Histórico de Créditos</h3>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Carregando...
              </p>
            ) : credits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum crédito encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {credits.map((credit) => (
                  <Card key={credit.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {getOriginLabel(credit.origem)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(credit.created_at), "dd 'de' MMMM 'de' yyyy", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${credit.usado ? 'text-muted-foreground line-through' : 'text-green-600'}`}>
                          + R$ {credit.valor.toFixed(2)}
                        </p>
                        {credit.usado ? (
                          <p className="text-xs text-muted-foreground mt-1">Utilizado</p>
                        ) : credit.expires_at ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Expira em {format(new Date(credit.expires_at), "dd/MM/yyyy")}
                          </p>
                        ) : (
                          <p className="text-xs text-green-600 mt-1">Disponível</p>
                        )}
                      </div>
                    </div>
                    {credit.usado && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-xs text-muted-foreground">
                          Status: Crédito já utilizado
                        </p>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
