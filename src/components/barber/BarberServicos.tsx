import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Scissors } from "lucide-react";

export function BarberServicos() {
  const [servicos, setServicos] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('servicos').select('*').eq('ativo', true).then(({ data }) => setServicos(data || []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Cortes Disponíveis</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servicos.map((s) => (
          <Card key={s.id} className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Scissors className="h-5 w-5 text-primary" /></div>
                <div><p className="font-medium">{s.nome}</p><p className="text-sm text-muted-foreground">R$ {s.preco} • {s.duracao_minutos}min</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
