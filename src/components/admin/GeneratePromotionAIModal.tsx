import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GeneratePromotionAIModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Proposta {
  titulo: string;
  descricao: string;
  desconto_percentual: number;
  regras: string[];
  data_inicio: string;
  data_fim: string;
  texto_divulgacao_curto: string;
  texto_divulgacao_longo: string;
  tags: string[];
}

export function GeneratePromotionAIModal({ open, onOpenChange, onSuccess }: GeneratePromotionAIModalProps) {
  const [servico, setServico] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [duracaoMaximaDias, setDuracaoMaximaDias] = useState(30);
  const [loading, setLoading] = useState(false);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [selectedProposta, setSelectedProposta] = useState<number | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setPropostas([]);
    setSelectedProposta(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-promotion-ai", {
        body: { servico, objetivo, duracaoMaximaDias },
      });

      if (error) throw error;

      if (data?.propostas) {
        setPropostas(data.propostas);
        toast.success("Promoções geradas com sucesso!");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao gerar promoções");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (selectedProposta === null) {
      toast.error("Selecione uma proposta");
      return;
    }

    const proposta = propostas[selectedProposta];
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const { error } = await supabase.from("promocoes").insert([{
        nome: proposta.titulo,
        descricao: proposta.descricao,
        pontos_necessarios: 0,
        ativo: true,
        gerada_por_ia: true,
        prompt_ia: JSON.stringify({ servico, objetivo, duracaoMaximaDias }),
        data_inicio: proposta.data_inicio,
        data_fim: proposta.data_fim,
        regras_json: proposta as any,
        aprovada_por: session.session.user.id,
        aprovada_em: new Date().toISOString(),
      }]);

      if (error) throw error;

      toast.success("Promoção criada e ativada!");
      onSuccess();
      onOpenChange(false);
      
      // Reset
      setPropostas([]);
      setSelectedProposta(null);
      setServico("");
      setObjetivo("");
      setDuracaoMaximaDias(30);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao criar promoção");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto card-glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar Promoção com IA
          </DialogTitle>
          <DialogDescription>
            Preencha os detalhes e deixe a IA criar 3 propostas de promoções personalizadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Form */}
          <div className="grid gap-4">
            <div>
              <Label htmlFor="servico">Serviço Alvo (opcional)</Label>
              <Input
                id="servico"
                placeholder="Ex: Corte + Barba"
                value={servico}
                onChange={(e) => setServico(e.target.value)}
                className="input-premium"
              />
            </div>

            <div>
              <Label htmlFor="objetivo">Objetivo da Promoção</Label>
              <Input
                id="objetivo"
                placeholder="Ex: Aumentar vendas às segundas-feiras"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="input-premium"
              />
            </div>

            <div>
              <Label htmlFor="duracao">Duração Máxima (dias)</Label>
              <Input
                id="duracao"
                type="number"
                value={duracaoMaximaDias}
                onChange={(e) => setDuracaoMaximaDias(Number(e.target.value))}
                className="input-premium"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !objetivo}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando propostas...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Propostas com IA
                </>
              )}
            </Button>
          </div>

          {/* Propostas */}
          {propostas.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Escolha uma proposta:</h3>
              
              <div className="grid gap-4 md:grid-cols-3">
                {propostas.map((proposta, index) => (
                  <Card
                    key={index}
                    className={`p-4 cursor-pointer transition-all card-glass hover-elevate ${
                      selectedProposta === index
                        ? "ring-2 ring-primary bg-primary/5"
                        : ""
                    }`}
                    onClick={() => setSelectedProposta(index)}
                  >
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-primary">{proposta.titulo}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {proposta.descricao}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="default">{proposta.desconto_percentual}% OFF</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(proposta.data_inicio).toLocaleDateString()} - {new Date(proposta.data_fim).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-semibold mb-1">Regras:</p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                          {proposta.regras.slice(0, 2).map((regra, i) => (
                            <li key={i}>{regra}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {proposta.tags?.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Button
                onClick={handleApprove}
                disabled={selectedProposta === null}
                className="w-full"
                size="lg"
              >
                Aprovar e Publicar Promoção
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
