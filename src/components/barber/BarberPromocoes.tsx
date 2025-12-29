import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Gift } from "lucide-react";

export function BarberPromocoes() {
  const [promocoes, setPromocoes] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('promocoes').select('*').eq('ativo', true).then(({ data }) => setPromocoes(data || []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Promoções Ativas</h1>
      {promocoes.length === 0 ? (
        <Card className="bg-card/50 border-border/50"><CardContent className="py-12 text-center"><Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Nenhuma promoção ativa</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {promocoes.map((p) => (
            <Card key={p.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Gift className="h-5 w-5 text-primary" /></div>
                  <div><p className="font-medium">{p.nome}</p><p className="text-sm text-muted-foreground">{p.descricao}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
