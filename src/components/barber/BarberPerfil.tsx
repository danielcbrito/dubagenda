import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save } from "lucide-react";

interface BarberPerfilProps {
  barbeiroId: string;
}

export function BarberPerfil({ barbeiroId }: BarberPerfilProps) {
  const [barbeiro, setBarbeiro] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('barbeiros').select('*').eq('id', barbeiroId).single().then(({ data }) => setBarbeiro(data));
  }, [barbeiroId]);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from('barbeiros').update({ apelido: barbeiro.apelido, telefone: barbeiro.telefone }).eq('id', barbeiroId);
    setLoading(false);
    if (error) toast.error('Erro ao salvar'); else toast.success('Perfil atualizado!');
  };

  if (!barbeiro) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
      <Card className="bg-card/50 border-border/50 max-w-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Apelido</Label><Input value={barbeiro.apelido || ''} onChange={(e) => setBarbeiro({ ...barbeiro, apelido: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={barbeiro.telefone || ''} onChange={(e) => setBarbeiro({ ...barbeiro, telefone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={barbeiro.email || ''} disabled className="opacity-50" /></div>
          <Button onClick={handleSave} disabled={loading}><Save className="h-4 w-4 mr-2" />Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
