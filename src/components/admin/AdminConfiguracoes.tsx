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

      {/* API Settings Placeholder */}
      <Card className="p-6 card-premium">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-primary" />
          <h3 className="font-semibold text-lg">Integrações</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          Em breve: Configuração de chaves de API (OpenAI, Mercado Pago, WhatsApp)
        </p>
      </Card>
    </div>
  );
}
