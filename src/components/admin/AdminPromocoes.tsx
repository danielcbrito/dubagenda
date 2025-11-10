import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Gift, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Promocao {
  id: string;
  nome: string;
  descricao: string | null;
  pontos_necessarios: number;
  ativo: boolean;
  weekly_required: boolean;
}

export function AdminPromocoes() {
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPromo, setNewPromo] = useState({
    nome: "",
    descricao: "",
    pontos_necessarios: 5,
    weekly_required: false,
  });

  useEffect(() => {
    loadPromocoes();

    const channel = supabase
      .channel('admin-promocoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promocoes' }, () => {
        loadPromocoes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPromocoes = async () => {
    try {
      const { data, error } = await supabase
        .from("promocoes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPromocoes(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading promocoes:", error);
      toast.error("Erro ao carregar promoções");
      setLoading(false);
    }
  };

  const handleCreatePromo = async () => {
    try {
      const { error } = await supabase
        .from("promocoes")
        .insert([newPromo]);

      if (error) throw error;
      
      toast.success("Promoção criada com sucesso!");
      setDialogOpen(false);
      setNewPromo({
        nome: "",
        descricao: "",
        pontos_necessarios: 5,
        weekly_required: false,
      });
    } catch (error) {
      console.error("Error creating promo:", error);
      toast.error("Erro ao criar promoção");
    }
  };

  const handleTogglePromo = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("promocoes")
        .update({ ativo: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentStatus ? "Promoção desativada" : "Promoção ativada");
    } catch (error) {
      console.error("Error toggling promo:", error);
      toast.error("Erro ao atualizar promoção");
    }
  };

  const handleDeletePromo = async (id: string) => {
    try {
      const { error } = await supabase
        .from("promocoes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Promoção removida");
    } catch (error) {
      console.error("Error deleting promo:", error);
      toast.error("Erro ao remover promoção");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Promoções</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Promoção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={newPromo.nome}
                  onChange={(e) => setNewPromo({ ...newPromo, nome: e.target.value })}
                  placeholder="Ex: Corte Grátis"
                  className="input-premium"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={newPromo.descricao}
                  onChange={(e) => setNewPromo({ ...newPromo, descricao: e.target.value })}
                  placeholder="Descreva a promoção..."
                  className="input-premium"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Pontos Necessários</label>
                <Input
                  type="number"
                  value={newPromo.pontos_necessarios}
                  onChange={(e) => setNewPromo({ ...newPromo, pontos_necessarios: parseInt(e.target.value) })}
                  className="input-premium"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newPromo.weekly_required}
                  onCheckedChange={(checked) => setNewPromo({ ...newPromo, weekly_required: checked })}
                />
                <label className="text-sm">Requer frequência semanal</label>
              </div>
              <Button onClick={handleCreatePromo} className="w-full">
                Criar Promoção
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-6 card-premium">
          <p className="text-muted-foreground">Carregando promoções...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promocoes.map((promo) => (
            <Card key={promo.id} className="p-6 card-premium">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Gift className="w-8 h-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{promo.nome}</h3>
                      <p className="text-sm text-muted-foreground">
                        {promo.pontos_necessarios} pontos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={promo.ativo}
                      onCheckedChange={() => handleTogglePromo(promo.id, promo.ativo)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeletePromo(promo.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {promo.descricao && (
                  <p className="text-sm text-muted-foreground">{promo.descricao}</p>
                )}
                {promo.weekly_required && (
                  <p className="text-xs text-primary">Requer frequência semanal</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
