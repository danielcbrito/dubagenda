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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Sparkles, MoreVertical, Trash2, Pencil, AlertTriangle, Check, Crown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
      setPlanos(prev => prev.map(p => p.id === id ? { ...p, ativo: !currentStatus } : p));
      
      const { error } = await supabase
        .from("planos")
        .update({ ativo: !currentStatus })
        .eq("id", id);

      if (error) {
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Planos</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os planos de assinatura • {planos.length} planos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="btn-neon gap-2">
              <Plus className="w-4 h-4" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg glass-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {editingPlano ? "Editar Plano" : "Criar Novo Plano"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium">Nome do Plano *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Plano Premium"
                  value={newPlano.nome}
                  onChange={(e) => setNewPlano({ ...newPlano, nome: e.target.value })}
                  className="input-glass"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descricao" className="text-sm font-medium">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descrição do plano..."
                  value={newPlano.descricao}
                  onChange={(e) => setNewPlano({ ...newPlano, descricao: e.target.value })}
                  className="input-glass resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preco" className="text-sm font-medium">Preço Mensal (R$) *</Label>
                  <Input
                    id="preco"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newPlano.preco_mensal || ""}
                    onChange={(e) => setNewPlano({ ...newPlano, preco_mensal: parseFloat(e.target.value) || 0 })}
                    className="input-glass"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limite" className="text-sm font-medium">Limite/Mês</Label>
                  <Input
                    id="limite"
                    type="number"
                    min="1"
                    placeholder="4"
                    value={newPlano.limite_agendamentos_mes || ""}
                    onChange={(e) => setNewPlano({ ...newPlano, limite_agendamentos_mes: parseInt(e.target.value) || 4 })}
                    className="input-glass"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prioridade" className="text-sm font-medium">Prioridade (maior = destaque)</Label>
                <Input
                  id="prioridade"
                  type="number"
                  placeholder="0"
                  value={newPlano.prioridade_agendamento || ""}
                  onChange={(e) => setNewPlano({ ...newPlano, prioridade_agendamento: parseInt(e.target.value) || 0 })}
                  className="input-glass"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Benefícios</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addBeneficio} className="h-8 text-xs">
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
                        className="input-glass"
                      />
                      {newPlano.beneficios_json.length > 1 && (
                        <Button 
                          type="button" 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => removeBeneficio(index)}
                          className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} className="flex-1 btn-neon">
                  {editingPlano ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid de Planos */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : planos.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <Sparkles className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" strokeWidth={1} />
          <p className="text-muted-foreground">Nenhum plano criado ainda</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {planos.map((plano, index) => (
            <Card 
              key={plano.id} 
              className={cn(
                "glass-card p-6 hover-elevate animate-fade-in relative overflow-hidden",
                !plano.ativo && "opacity-60",
                plano.prioridade_agendamento && plano.prioridade_agendamento > 0 && "border-gold/30"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Badge Premium */}
              {plano.prioridade_agendamento && plano.prioridade_agendamento > 0 && (
                <div className="absolute top-4 right-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center shadow-glow-gold">
                    <Crown className="w-4 h-4 text-gold-foreground" />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Header */}
                <div className="pr-10">
                  <h3 className="text-xl font-bold text-foreground mb-1">{plano.nome}</h3>
                  {plano.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{plano.descricao}</p>
                  )}
                </div>

                {/* Preço */}
                <div className="py-4 border-y border-border/30">
                  <span className="text-3xl font-bold price-gold">
                    R$ {plano.preco_mensal.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>

                {/* Info */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {plano.limite_agendamentos_mes && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/50">
                      📅 {plano.limite_agendamentos_mes} agendamentos/mês
                    </span>
                  )}
                </div>

                {/* Benefícios */}
                {plano.beneficios_json && plano.beneficios_json.length > 0 && (
                  <ul className="space-y-2">
                    {plano.beneficios_json.slice(0, 4).map((beneficio, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{beneficio}</span>
                      </li>
                    ))}
                    {plano.beneficios_json.length > 4 && (
                      <li className="text-xs text-muted-foreground pl-6">
                        +{plano.beneficios_json.length - 4} mais benefícios
                      </li>
                    )}
                  </ul>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                  <div className="flex items-center gap-3">
                    <span className={cn("status-tag", plano.ativo ? "active" : "blocked")}>
                      {plano.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={plano.ativo}
                      onCheckedChange={() => handleTogglePlano(plano.id, plano.ativo)}
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleOpenDialog(plano)} className="gap-2">
                        <Pencil className="w-4 h-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenDeleteDialog(plano)} className="gap-2 text-destructive">
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {planoToDelete && (
                <>
                  O plano "<strong>{planoToDelete.nome}</strong>" será removido permanentemente.
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
