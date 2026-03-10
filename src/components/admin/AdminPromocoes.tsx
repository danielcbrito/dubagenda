import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbeiroLogado } from "@/hooks/useBarbeiroLogado";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Gift, Trash2, Sparkles, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GeneratePromotionAIModal } from "./GeneratePromotionAIModal";

interface Promocao {
  id: string;
  nome: string;
  descricao: string | null;
  pontos_necessarios: number;
  ativo: boolean;
  weekly_required: boolean;
  tenant_id: string | null;
}

export function AdminPromocoes() {
  const { barbeiro } = useBarbeiroLogado();
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promocao | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [newPromo, setNewPromo] = useState({
    nome: "",
    descricao: "",
    pontos_necessarios: 5,
    weekly_required: false,
  });

  // Helper para obter tenant_id do barbeiro logado
  const getBarberTenantId = async (): Promise<string | null> => {
    if (!barbeiro) return null;
    const { data } = await supabase
      .from("barbeiros")
      .select("tenant_id")
      .eq("id", barbeiro.id)
      .maybeSingle();
    return data?.tenant_id || null;
  };

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
      const currentTenantId = await getBarberTenantId();

      let query = supabase
        .from("promocoes")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentTenantId) {
        query = query.eq("tenant_id", currentTenantId);
      }

      const { data, error } = await query;

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
      const tenantId = await getBarberTenantId();
      const payload: any = { ...newPromo };
      if (tenantId) {
        payload.tenant_id = tenantId;
      }

      const { error } = await supabase
        .from("promocoes")
        .insert([payload]);

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

  const handleUpdatePromo = async () => {
    if (!editingPromo) return;
    try {
      const { error } = await supabase
        .from("promocoes")
        .update({
          nome: editingPromo.nome,
          descricao: editingPromo.descricao,
          pontos_necessarios: editingPromo.pontos_necessarios,
          weekly_required: editingPromo.weekly_required,
        })
        .eq("id", editingPromo.id);

      if (error) throw error;
      toast.success("Promoção atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingPromo(null);
    } catch (error) {
      console.error("Error updating promo:", error);
      toast.error("Erro ao atualizar promoção");
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-widest mb-2">PROMOÇÕES</h1>
          <p className="text-muted-foreground text-sm tracking-wide">Gerencie promoções e benefícios exclusivos</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setAiModalOpen(true)} 
            className="gap-2 glow-red hover-elevate border-primary/30 bg-primary/5"
          >
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">Gerar com IA</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-primary shadow-glow-red hover-elevate">
                <Plus className="w-5 h-5" />
                <span className="font-semibold">Nova Promoção</span>
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
      </div>

      {loading ? (
        <div className="card-glass p-12 text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground font-medium tracking-wide">Carregando promoções premium...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {promocoes.map((promo) => (
            <div key={promo.id} className="card-glass p-8 hover-elevate group">
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="stat-card-icon">
                      <Gift className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg tracking-wide">{promo.nome}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="border-primary/30 text-primary font-bold">
                          {promo.pontos_necessarios} pontos
                        </Badge>
                        {promo.ativo ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ATIVO</Badge>
                        ) : (
                          <Badge variant="secondary">INATIVO</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={promo.ativo}
                      onCheckedChange={() => handleTogglePromo(promo.id, promo.ativo)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingPromo({ ...promo });
                        setEditDialogOpen(true);
                      }}
                      className="hover:bg-primary/20 hover:text-primary transition-all"
                    >
                      <Pencil className="w-4 h-4" strokeWidth={2} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeletePromo(promo.id)}
                      className="hover:bg-destructive/20 hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-5 h-5" strokeWidth={2} />
                    </Button>
                  </div>
                </div>
                {promo.descricao && (
                  <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-4">
                    {promo.descricao}
                  </p>
                )}
                {promo.weekly_required && (
                  <div className="flex items-center gap-2 text-xs text-primary font-semibold tracking-wide">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-glow-red"></div>
                    REQUER FREQUÊNCIA SEMANAL
                  </div>
                )}
              </div>
            </div>
          ))}

          {promocoes.length === 0 && (
            <div className="col-span-full card-glass p-16 text-center">
              <Gift className="w-16 h-16 mx-auto mb-6 text-muted-foreground/50" strokeWidth={1.5} />
              <h3 className="text-xl font-bold mb-2 tracking-wide">Nenhuma promoção cadastrada</h3>
              <p className="text-muted-foreground mb-6">Crie sua primeira promoção premium para fidelizar clientes</p>
              <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-gradient-primary shadow-glow-red">
                <Plus className="w-5 h-5" />
                Criar Primeira Promoção
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Promoção</DialogTitle>
          </DialogHeader>
          {editingPromo && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={editingPromo.nome}
                  onChange={(e) => setEditingPromo({ ...editingPromo, nome: e.target.value })}
                  className="input-premium"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={editingPromo.descricao || ""}
                  onChange={(e) => setEditingPromo({ ...editingPromo, descricao: e.target.value })}
                  className="input-premium"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Pontos Necessários</label>
                <Input
                  type="number"
                  min={2}
                  value={editingPromo.pontos_necessarios}
                  onChange={(e) => setEditingPromo({ ...editingPromo, pontos_necessarios: parseInt(e.target.value) || 2 })}
                  className="input-premium"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingPromo.weekly_required}
                  onCheckedChange={(checked) => setEditingPromo({ ...editingPromo, weekly_required: checked })}
                />
                <label className="text-sm">Requer frequência semanal</label>
              </div>
              <Button onClick={handleUpdatePromo} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <GeneratePromotionAIModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        onSuccess={loadPromocoes}
      />
    </div>
  );
}
