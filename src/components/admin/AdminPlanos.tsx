import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Plano {
  id: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  limite_agendamentos_mes: number | null;
  prioridade_agendamento: number | null;
  beneficios_json: string[] | null;
  ativo: boolean;
}

export function AdminPlanos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planoToDelete, setPlanoToDelete] = useState<Plano | null>(null);
  const [newPlano, setNewPlano] = useState({
    nome: "",
    descricao: "",
    preco_mensal: 0,
    limite_agendamentos_mes: 4,
    prioridade_agendamento: 0,
    beneficios_json: [""],
  });

  useEffect(() => {
    loadPlanos();

    const channel = supabase
      .channel('admin-planos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planos' }, () => {
        loadPlanos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPlanos = async () => {
    try {
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .order("prioridade_agendamento", { ascending: false });

      if (error) throw error;
      
      // Normalize beneficios_json to always be string array
      const normalizedData = (data || []).map(plano => ({
        ...plano,
        beneficios_json: Array.isArray(plano.beneficios_json) 
          ? plano.beneficios_json 
          : typeof plano.beneficios_json === 'string'
          ? JSON.parse(plano.beneficios_json)
          : []
      }));
      
      setPlanos(normalizedData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading planos:", error);
      toast.error("Erro ao carregar planos");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewPlano({
      nome: "",
      descricao: "",
      preco_mensal: 0,
      limite_agendamentos_mes: 4,
      prioridade_agendamento: 0,
      beneficios_json: [""],
    });
    setEditingPlano(null);
  };

  const handleOpenDialog = (plano?: Plano) => {
    if (plano) {
      setEditingPlano(plano);
      setNewPlano({
        nome: plano.nome,
        descricao: plano.descricao || "",
        preco_mensal: plano.preco_mensal,
        limite_agendamentos_mes: plano.limite_agendamentos_mes || 4,
        prioridade_agendamento: plano.prioridade_agendamento || 0,
        beneficios_json: plano.beneficios_json && plano.beneficios_json.length > 0 
          ? plano.beneficios_json 
          : [""],
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

  const handleSubmit = async () => {
    if (!newPlano.nome || newPlano.preco_mensal <= 0) {
      toast.error("Preencha nome e preço do plano");
      return;
    }

    try {
      const payload = {
        ...newPlano,
        beneficios_json: newPlano.beneficios_json.filter(b => b.trim() !== "")
      };

      if (editingPlano) {
        const { error } = await supabase
          .from("planos")
          .update(payload)
          .eq("id", editingPlano.id);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("planos")
          .insert([payload]);

        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving plano:", error);
      toast.error("Erro ao salvar plano");
    }
  };

  const handleTogglePlano = async (id: string, currentStatus: boolean) => {
    try {
      // Update optimistically for instant UI feedback
      setPlanos(prev => prev.map(p => p.id === id ? { ...p, ativo: !currentStatus } : p));
      
      const { error } = await supabase
        .from("planos")
        .update({ ativo: !currentStatus })
        .eq("id", id);

      if (error) {
        // Revert on error
        setPlanos(prev => prev.map(p => p.id === id ? { ...p, ativo: currentStatus } : p));
        throw error;
      }
      toast.success(currentStatus ? "Plano desativado" : "Plano ativado");
    } catch (error) {
      console.error("Error toggling plano:", error);
      toast.error("Erro ao atualizar plano");
    }
  };

  const handleOpenDeleteDialog = (plano: Plano) => {
    setPlanoToDelete(plano);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!planoToDelete) return;

    try {
      const { error } = await supabase
        .from("planos")
        .delete()
        .eq("id", planoToDelete.id);

      if (error) throw error;
      
      toast.success("Plano removido com sucesso");
      loadPlanos();
    } catch (error: any) {
      toast.error("Erro ao excluir plano: " + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setPlanoToDelete(null);
    }
  };

  const addBeneficio = () => {
    setNewPlano(prev => ({
      ...prev,
      beneficios_json: [...prev.beneficios_json, ""]
    }));
  };

  const updateBeneficio = (index: number, value: string) => {
    setNewPlano(prev => ({
      ...prev,
      beneficios_json: prev.beneficios_json.map((b, i) => i === index ? value : b)
    }));
  };

  const removeBeneficio = (index: number) => {
    setNewPlano(prev => ({
      ...prev,
      beneficios_json: prev.beneficios_json.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planos de Assinatura</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlano ? "Editar Plano" : "Criar Novo Plano"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="nome">Nome do Plano *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Plano Corte Premium"
                  value={newPlano.nome}
                  onChange={(e) => setNewPlano({ ...newPlano, nome: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descrição do plano..."
                  value={newPlano.descricao}
                  onChange={(e) => setNewPlano({ ...newPlano, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preco">Preço Mensal (R$) *</Label>
                  <Input
                    id="preco"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newPlano.preco_mensal || ""}
                    onChange={(e) => setNewPlano({ ...newPlano, preco_mensal: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label htmlFor="limite">Limite de Agendamentos/Mês</Label>
                  <Input
                    id="limite"
                    type="number"
                    min="1"
                    placeholder="4"
                    value={newPlano.limite_agendamentos_mes || ""}
                    onChange={(e) => setNewPlano({ ...newPlano, limite_agendamentos_mes: parseInt(e.target.value) || 4 })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="prioridade">Prioridade (maior = mais destaque)</Label>
                <Input
                  id="prioridade"
                  type="number"
                  placeholder="0"
                  value={newPlano.prioridade_agendamento || ""}
                  onChange={(e) => setNewPlano({ ...newPlano, prioridade_agendamento: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Benefícios</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addBeneficio}>
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {newPlano.beneficios_json.map((beneficio, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Benefício ${index + 1}`}
                        value={beneficio}
                        onChange={(e) => updateBeneficio(index, e.target.value)}
                      />
                      {newPlano.beneficios_json.length > 1 && (
                        <Button 
                          type="button" 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => removeBeneficio(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} className="flex-1">
                  {editingPlano ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Carregando planos...
        </div>
      ) : planos.length === 0 ? (
        <Card className="p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Nenhum plano criado ainda</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {planos.map((plano) => (
            <Card key={plano.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{plano.nome}</h3>
                    <span className="text-xl font-bold text-primary">
                      R$ {plano.preco_mensal.toFixed(2)}/mês
                    </span>
                  </div>
                  
                  {plano.descricao && (
                    <p className="text-sm text-muted-foreground mb-3">{plano.descricao}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                    {plano.limite_agendamentos_mes && (
                      <span>📅 {plano.limite_agendamentos_mes} agendamentos/mês</span>
                    )}
                    <span>⭐ Prioridade: {plano.prioridade_agendamento || 0}</span>
                  </div>

                  {plano.beneficios_json && plano.beneficios_json.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold mb-2">Benefícios:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {plano.beneficios_json.map((beneficio, index) => (
                          <li key={index}>✓ {beneficio}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={plano.ativo}
                    onCheckedChange={() => handleTogglePlano(plano.id, plano.ativo)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(plano)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDeleteDialog(plano)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Tem certeza que deseja remover este plano?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {planoToDelete && (
                <>
                  O plano "<strong>{planoToDelete.nome}</strong>" será removido permanentemente. Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
