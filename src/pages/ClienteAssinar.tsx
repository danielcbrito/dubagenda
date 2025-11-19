import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  limite_agendamentos_mes: number;
}

const ClienteAssinar = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: select plan, 2: payment method, 3: confirm
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('card');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    loadPlans();
    checkActiveSubscription();
  }, []);

  const checkActiveSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();

    setHasActiveSubscription(!!data);
  };

  const loadPlans = async () => {
    const { data } = await supabase
      .from('planos')
      .select('*')
      .eq('ativo', true)
      .order('preco_mensal');

    setPlans(data || []);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          planoId: selectedPlan.id,
          paymentMethod,
        }
      });

      if (error) throw error;

      toast.success(data.message);
      navigate("/cliente");
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error("Erro ao criar assinatura: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10 backdrop-blur-lg bg-card/80">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate("/cliente") : setStep(step - 1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">Assinar Plano</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {hasActiveSubscription && (
          <Card className="p-4 bg-primary/10 border-primary/20">
            <p className="text-sm">
              Você já possui uma assinatura ativa. Cancele-a antes de assinar outro plano.
            </p>
          </Card>
        )}

        {/* Step 1: Select Plan */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-3">Escolha seu Plano</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione o plano ideal para você
              </p>
            </div>
            
            <div className="grid gap-4">
              {plans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                const benefits = plan.beneficios_json || [];
                
                return (
                  <Card
                    key={plan.id}
                    className={`p-6 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "card-premium hover:border-primary/50"
                    }`}
                    onClick={() => !hasActiveSubscription && setSelectedPlan(plan)}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold">{plan.nome}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {plan.descricao}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="bg-primary rounded-full p-2">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-primary">
                          R$ {plan.preco_mensal.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-semibold">Benefícios:</div>
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{plan.limite_agendamentos_mes} agendamentos por mês</span>
                          </li>
                          {benefits.map((benefit: string, index: number) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!selectedPlan || hasActiveSubscription}
              className="w-full"
              size="lg"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === 2 && selectedPlan && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-3">Forma de Pagamento</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Escolha como deseja pagar sua assinatura mensal
              </p>
            </div>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{selectedPlan.nome}</div>
                  <div className="text-sm text-muted-foreground">Cobrança mensal</div>
                </div>
                <div className="text-2xl font-bold text-primary">
                  R$ {selectedPlan.preco_mensal.toFixed(2)}
                </div>
              </div>
            </Card>

            <div className="grid gap-3">
              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "card-premium hover:border-primary/50"
                }`}
                onClick={() => setPaymentMethod('card')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'card' ? 'border-primary' : 'border-muted'
                  }`}>
                    {paymentMethod === 'card' && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      <h4 className="font-semibold">Cartão de Crédito</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cobrança automática mensal
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'pix'
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "card-premium hover:border-primary/50"
                }`}
                onClick={() => setPaymentMethod('pix')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'pix' ? 'border-primary' : 'border-muted'
                  }`}>
                    {paymentMethod === 'pix' && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">PIX</h4>
                    <p className="text-xs text-muted-foreground">
                      Você receberá um QR Code todo mês
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Button
              onClick={() => setStep(3)}
              className="w-full"
              size="lg"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedPlan && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-3">Confirmar Assinatura</h2>
            </div>

            <Card className="p-6 space-y-4 card-premium">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Plano:</span>
                  <span className="font-semibold">{selectedPlan.nome}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Forma de Pagamento:</span>
                  <span className="font-semibold">
                    {paymentMethod === 'card' ? 'Cartão de Crédito' : 'PIX'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Cobrança:</span>
                  <span className="font-semibold">Mensal</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-primary/10 -m-6 mt-2 px-6 rounded-b-lg">
                  <span className="font-semibold">Valor Mensal:</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {selectedPlan.preco_mensal.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              <p>
                Ao confirmar, você autoriza cobranças mensais de R$ {selectedPlan.preco_mensal.toFixed(2)}.
                Você pode cancelar a qualquer momento.
              </p>
            </div>

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Processando..." : "Confirmar Assinatura"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClienteAssinar;
