import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw } from "lucide-react";

/**
 * Painel de Configuração do Chat IA
 * Permite admin configurar o tom/personalidade das respostas
 */
export function AdminSuporteConfig() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { toast } = useToast();

  const DEFAULT_PROMPT = `Seja educado, profissional e prestativo. Use linguagem clara e objetiva. Mantenha tom neutro e acolhedor.`;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('informacoes_empresa')
        .select('valor')
        .eq('chave', 'chat_personality_prompt')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPrompt(data.valor);
      } else {
        setPrompt(DEFAULT_PROMPT);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('informacoes_empresa')
        .upsert({
          chave: 'chat_personality_prompt',
          categoria: 'suporte',
          valor: prompt,
          ativo: true
        }, {
          onConflict: 'chave'
        });

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "O prompt de personalidade foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a configuração.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configurações do Chat IA</h2>
        <p className="text-muted-foreground mt-2">
          Configure o tom e estilo das respostas do assistente de suporte
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle>Prompt de Personalidade</CardTitle>
          <CardDescription>
            Define o tom e estilo das respostas. A inteligência base não é alterada, apenas o modo de comunicação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Instruções de Estilo</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Seja formal e direto, use linguagem técnica..."
              className="min-h-[200px] bg-background/50 border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              Exemplos: "Seja formal e profissional" / "Use linguagem casual e amigável" / "Seja direto e técnico"
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={saveConfig}
              disabled={loading || !prompt.trim()}
              className="bg-gradient-primary hover:shadow-glow-red"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configuração
                </>
              )}
            </Button>
            <Button
              onClick={resetToDefault}
              variant="outline"
              disabled={loading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar Padrão
            </Button>
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mt-6">
            <h4 className="font-semibold text-sm text-foreground mb-2">Sobre a Inteligência</h4>
            <p className="text-sm text-muted-foreground">
              O sistema já possui inteligência completa sobre o aplicativo, funcionalidades e resolução de problemas. 
              Este prompt afeta APENAS o tom das respostas, não a capacidade de resolver problemas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
