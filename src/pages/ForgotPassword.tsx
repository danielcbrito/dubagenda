import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

const emailSchema = z.object({
  email: z.string().trim().email("Email inválido"),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = emailSchema.parse({ email });

      // Use production URL for email redirects (never localhost)
      const productionUrl = window.location.origin.includes('localhost') 
        ? 'https://djtpzvujzmrrslirzwun.lovable.app'
        : window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(
        validated.email,
        {
          redirectTo: `${productionUrl}/resetar-senha`,
        }
      );

      if (error) {
        toast.error("Erro ao enviar email: " + error.message);
        return;
      }

      setEmailSent(true);
      toast.success("Email de recuperação enviado!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao processar solicitação");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 card-premium">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logoDub} alt="Barbearia DUB" className="w-20 h-20 object-contain" />
        </div>

        {!emailSent ? (
          <>
            {/* Title */}
            <h2 className="text-2xl font-bold text-center mb-2">
              Esqueceu sua senha?
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Digite seu email para receber as instruções de recuperação
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-premium mt-1"
                  placeholder="seu@email.com"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar email de recuperação
                  </>
                )}
              </Button>
            </form>
          </>
        ) : (
          <>
            {/* Success message */}
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Email enviado!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Verifique sua caixa de entrada em <strong>{email}</strong> e siga as instruções para redefinir sua senha.
              </p>
              <Button 
                onClick={() => navigate("/auth")}
                className="w-full h-11 bg-primary hover:bg-primary/90"
              >
                Voltar para login
              </Button>
            </div>
          </>
        )}

        {/* Back button */}
        {!emailSent && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para login
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;
