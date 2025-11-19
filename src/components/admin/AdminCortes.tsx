import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  duracao_minutos: number;
  ativo: boolean;
}

export function AdminCortes() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    preco: "",
    duracao_minutos: "",
    ativo: true,
  });

  useEffect(() => {
    loadServicos();

    const channel = supabase
      .channel("servicos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servicos" },
        () => {
          loadServicos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadServicos = async () => {
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .order("nome");

      if (error) throw error;
      setServicos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar cortes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      preco: "",
      duracao_minutos: "",
      ativo: true,
    });
    setEditingServico(null);
  };

  const handleOpenDialog = (servico?: Servico) => {
    if (servico) {
      setEditingServico(servico);
      setFormData({
        nome: servico.nome,
        descricao: servico.descricao || "",
        preco: servico.preco.toString(),
        duracao_minutos: servico.duracao_minutos.toString(),
        ativo: servico.ativo,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.preco || !formData.duracao_minutos) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const payload = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim() || null,
      preco: parseFloat(formData.preco),
      duracao_minutos: parseInt(formData.duracao_minutos),
      ativo: formData.ativo,
    };

    try {
      if (editingServico) {
        const { error } = await supabase
          .from("servicos")
          .update(payload)
          .eq("id", editingServico.id);

        if (error) throw error;
        toast.success("Corte atualizado com sucesso");
      } else {
        const { error } = await supabase.from("servicos").insert(payload);

        if (error) throw error;
        toast.success("Corte criado com sucesso");
      }

      handleCloseDialog();
      loadServicos();
    } catch (error: any) {
      toast.error("Erro ao salvar corte: " + error.message);
    }
  };

  const handleToggleAtivo = async (servico: Servico) => {
    try {
      const { error } = await supabase
        .from("servicos")
        .update({ ativo: !servico.ativo })
        .eq("id", servico.id);

      if (error) throw error;
      toast.success(
        servico.ativo ? "Corte desativado" : "Corte ativado"
      );
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este corte?")) return;

    try {
      const { error } = await supabase.from("servicos").delete().eq("id", id);

      if (error) throw error;
      toast.success("Corte excluído com sucesso");
      loadServicos();
    } catch (error: any) {
      toast.error("Erro ao excluir corte: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cortes</h1>
          <p className="text-muted-foreground">
            Gerencie os serviços de corte oferecidos
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Corte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingServico ? "Editar Corte" : "Novo Corte"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Corte Social"
                  required
                />
              </div>

              <div>
                <Label htmlFor="preco">Preço (R$) *</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) =>
                    setFormData({ ...formData, preco: e.target.value })
                  }
                  placeholder="50.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="duracao">Duração (minutos) *</Label>
                <Input
                  id="duracao"
                  type="number"
                  value={formData.duracao_minutos}
                  onChange={(e) =>
                    setFormData({ ...formData, duracao_minutos: e.target.value })
                  }
                  placeholder="30"
                  required
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  placeholder="Descrição do corte"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, ativo: checked })
                  }
                />
                <Label htmlFor="ativo">Corte ativo</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingServico ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {servicos.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum corte cadastrado ainda
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {servicos.map((servico) => (
            <Card key={servico.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      {servico.nome}
                    </h3>
                    <span className="text-lg font-bold text-primary">
                      R$ {servico.preco.toFixed(2)}
                    </span>
                  </div>

                  {servico.descricao && (
                    <p className="text-sm text-muted-foreground">
                      {servico.descricao}
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Duração: {servico.duracao_minutos} minutos
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={servico.ativo}
                    onCheckedChange={() => handleToggleAtivo(servico)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(servico)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(servico.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
