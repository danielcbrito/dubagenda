import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Settings, Package } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  ativo: boolean;
}

export function AdminConfiguracoes() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({
    nome: "",
    descricao: "",
    preco_mensal: 0,
    beneficios: ""
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("planos")
      .select("id, nome, descricao, preco_mensal, ativo")
      .order("prioridade_agendamento", { ascending: true });

    setPlans(data || []);
    setLoading(false);
  };

  const handleToggleActive = async (planId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("planos")
      .update({ ativo: !currentStatus })
      .eq("id", planId);

    if (error) {
      toast.error("Erro ao atualizar plano");
      return;
    }

    toast.success(`Plano ${!currentStatus ? "ativado" : "desativado"}`);
    loadPlans();
  };

  const handleUpdatePlan = async (planId: string, field: string, value: any) => {
    const { error } = await supabase
      .from("planos")
      .update({ [field]: value })
      .eq("id", planId);

    if (error) {
      toast.error("Erro ao atualizar plano");
      return;
    }

    toast.success("Plano atualizado");
    loadPlans();
  };

  const handleCreatePlan = async () => {
    if (!newPlan.nome || newPlan.preco_mensal <= 0) {
      toast.error("Preencha nome e preço do plano");
      return;
    }

    setCreating(true);

    // Parse benefits from text (one per line)
    const beneficiosArray = newPlan.beneficios
      .split('\n')
      .filter(b => b.trim())
      .map(b => b.trim());

    const { error } = await supabase
      .from("planos")
      .insert([{
        nome: newPlan.nome,
        descricao: newPlan.descricao,
        preco_mensal: newPlan.preco_mensal,
        beneficios_json: beneficiosArray,
        ativo: true,
        prioridade_agendamento: 0
      }]);

    if (error) {
      toast.error("Erro ao criar plano");
      console.error(error);
    } else {
      toast.success("✅ Plano criado com sucesso!");
      setNewPlan({ nome: "", descricao: "", preco_mensal: 0, beneficios: "" });
      loadPlans();
    }

    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* Plans Management */}
      <Card className="p-6 card-premium">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6 text-primary" />
          <h3 className="font-semibold text-lg">Gerenciar Planos</h3>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6">
            {/* Create New Plan Section */}
            <div className="p-4 rounded-lg bg-primary/5 border-2 border-dashed border-primary/20 space-y-4">
              <h4 className="font-semibold text-sm">➕ Adicionar Novo Plano</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-nome">Nome do Plano *</Label>
                  <Input
                    id="new-nome"
                    placeholder="Ex: Plano Premium"
                    value={newPlan.nome}
                    onChange={(e) => setNewPlan({ ...newPlan, nome: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-preco">Preço Mensal (R$) *</Label>
                  <Input
                    id="new-preco"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newPlan.preco_mensal || ""}
                    onChange={(e) => setNewPlan({ ...newPlan, preco_mensal: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-desc">Descrição</Label>
                <Input
                  id="new-desc"
                  placeholder="Descrição curta do plano"
                  value={newPlan.descricao}
                  onChange={(e) => setNewPlan({ ...newPlan, descricao: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-beneficios">Benefícios (um por linha)</Label>
                <Textarea
                  id="new-beneficios"
                  placeholder="4 cortes por mês&#10;Atendimento prioritário&#10;Desconto em produtos"
                  rows={4}
                  value={newPlan.beneficios}
                  onChange={(e) => setNewPlan({ ...newPlan, beneficios: e.target.value })}
                />
              </div>

              <Button
                onClick={handleCreatePlan}
                disabled={creating}
                className="w-full"
              >
                {creating ? "Criando..." : "Criar Plano"}
              </Button>
            </div>

            {/* Existing Plans */}
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="p-4 rounded-lg bg-muted/30 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{plan.nome}</h4>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${plan.id}`} className="text-xs">
                      {plan.ativo ? "Ativo" : "Inativo"}
                    </Label>
                    <Switch
                      id={`active-${plan.id}`}
                      checked={plan.ativo}
                      onCheckedChange={() => handleToggleActive(plan.id, plan.ativo)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`nome-${plan.id}`}>Nome do Plano</Label>
                    <Input
                      id={`nome-${plan.id}`}
                      defaultValue={plan.nome}
                      onBlur={(e) => {
                        if (e.target.value !== plan.nome) {
                          handleUpdatePlan(plan.id, "nome", e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`preco-${plan.id}`}>Preço Mensal (R$)</Label>
                    <Input
                      id={`preco-${plan.id}`}
                      type="number"
                      step="0.01"
                      defaultValue={plan.preco_mensal}
                      onBlur={(e) => {
                        const newValue = parseFloat(e.target.value);
                        if (newValue !== plan.preco_mensal) {
                          handleUpdatePlan(plan.id, "preco_mensal", newValue);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`desc-${plan.id}`}>Descrição</Label>
                  <Textarea
                    id={`desc-${plan.id}`}
                    defaultValue={plan.descricao || ""}
                    rows={2}
                    onBlur={(e) => {
                      if (e.target.value !== plan.descricao) {
                        handleUpdatePlan(plan.id, "descricao", e.target.value);
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Google Calendar Integration */}
      <Card className="p-6 card-premium">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-primary" />
          <h3 className="font-semibold text-lg">Google Calendar</h3>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para sincronizar agendamentos com o Google Calendar, você precisa configurar as seguintes variáveis no Supabase:
          </p>
          
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-xs font-mono">GOOGLE_CLIENT_ID</p>
            <p className="text-xs font-mono">GOOGLE_CLIENT_SECRET</p>
            <p className="text-xs font-mono">GOOGLE_REFRESH_TOKEN</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Como configurar:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Acesse o Google Cloud Console</li>
              <li>Crie um projeto e ative a Google Calendar API</li>
              <li>Crie credenciais OAuth 2.0</li>
              <li>Gere um Refresh Token usando as credenciais</li>
              <li>Adicione as variáveis no Supabase Dashboard (Edge Functions Secrets)</li>
            </ol>
          </div>
          
          <Button
            variant="outline"
            onClick={() => window.open('https://console.cloud.google.com', '_blank')}
            className="w-full"
          >
            Abrir Google Cloud Console
          </Button>
        </div>
      </Card>
    </div>
  );
}
