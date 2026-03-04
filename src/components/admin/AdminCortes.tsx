import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbeiroLogado } from "@/hooks/useBarbeiroLogado";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Scissors, Clock, MoreVertical, Pencil, Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  duracao_minutos: number;
  ativo: boolean;
}

export function AdminCortes() {
  const { barbeiro } = useBarbeiroLogado();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [servicoToDelete, setServicoToDelete] = useState<Servico | null>(null);
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
      // Determinar tenant_id do barbeiro logado
      let tenantId: string | null = null;
      if (barbeiro) {
        const { data: barberData } = await supabase
          .from("barbeiros")
          .select("tenant_id")
          .eq("id", barbeiro.id)
          .maybeSingle();
        tenantId = barberData?.tenant_id || null;
      }

      let query = supabase
        .from("servicos")
        .select("*")
        .order("nome");

      // Filtrar pelo tenant do barbeiro logado
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query;
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

    // Obter tenant_id do barbeiro logado
    let tenantId: string | null = null;
    if (barbeiro) {
      const { data: barberData } = await supabase
        .from("barbeiros")
        .select("tenant_id")
        .eq("id", barbeiro.id)
        .maybeSingle();
      tenantId = barberData?.tenant_id || null;
    }

    const payload: any = {
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
        // Incluir tenant_id na criação de novos serviços
        if (tenantId) {
          payload.tenant_id = tenantId;
        }
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
      toast.success(servico.ativo ? "Corte desativado" : "Corte ativado");
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleOpenDeleteDialog = (servico: Servico) => {
    setServicoToDelete(servico);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!servicoToDelete) {
      setDeleteDialogOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("servicos")
        .delete()
        .eq("id", servicoToDelete.id);

      if (error) throw error;
      
      toast.success("Corte removido com sucesso");
      loadServicos();
    } catch (error: any) {
      toast.error("Erro ao excluir corte: " + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setServicoToDelete(null);
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Cortes</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os serviços de corte • {servicos.length} serviços
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="btn-neon gap-2">
              <Plus className="w-4 h-4" />
              Novo Corte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Scissors className="w-5 h-5 text-primary" />
                </div>
                <span>{editingServico ? "Editar Corte" : "Novo Corte"}</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium text-muted-foreground">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Corte Social"
                  className="h-11 bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preco" className="text-sm font-medium text-muted-foreground">Preço (R$) *</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    value={formData.preco}
                    onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                    placeholder="50.00"
                    className="h-11 bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duracao" className="text-sm font-medium text-muted-foreground">Duração (min) *</Label>
                  <Input
                    id="duracao"
                    type="number"
                    value={formData.duracao_minutos}
                    onChange={(e) => setFormData({ ...formData, duracao_minutos: e.target.value })}
                    placeholder="30"
                    className="h-11 bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao" className="text-sm font-medium text-muted-foreground">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição do corte"
                  rows={3}
                  className="bg-white/[0.03] border-white/[0.08] rounded-xl resize-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo" className="text-sm font-medium cursor-pointer text-foreground">
                  Corte ativo e disponível para agendamento
                </Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseDialog} 
                  className="flex-1 h-11 rounded-xl bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12] font-medium"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 font-semibold shadow-[0_0_20px_rgba(255,59,59,0.3)] transition-all hover:shadow-[0_0_30px_rgba(255,59,59,0.4)]"
                >
                  {editingServico ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid de serviços */}
      {servicos.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <Scissors className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" strokeWidth={1} />
          <p className="text-muted-foreground">Nenhum corte cadastrado ainda</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {servicos.map((servico, index) => (
            <Card 
              key={servico.id} 
              className={cn(
                "glass-card p-5 hover-elevate animate-fade-in",
                !servico.ativo && "opacity-60"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-red">
                  <Scissors className="w-5 h-5 text-white" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => handleOpenDialog(servico)} className="gap-2">
                      <Pencil className="w-4 h-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenDeleteDialog(servico)} className="gap-2 text-destructive">
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{servico.nome}</h3>
                  {servico.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{servico.descricao}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{servico.duracao_minutos} min</span>
                  </div>
                  <span className="text-xl font-bold price-gold">
                    R$ {servico.preco.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className={cn(
                    "status-tag",
                    servico.ativo ? "active" : "blocked"
                  )}>
                    {servico.ativo ? "Ativo" : "Inativo"}
                  </span>
                  <Switch
                    checked={servico.ativo}
                    onCheckedChange={() => handleToggleAtivo(servico)}
                  />
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
              {servicoToDelete && (
                <>
                  O corte "<strong>{servicoToDelete.nome}</strong>" será removido permanentemente.
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
