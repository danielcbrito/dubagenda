import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2 } from "lucide-react";

const signupSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  cpf: z.string().trim().regex(/^\d{11}$/, "CPF deve ter 11 dígitos").max(11),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: "",
    senha: "",
  });

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserRoleAndRedirect(session.user.id);
      }
    });
  }, []);

  const checkUserRoleAndRedirect = async (userId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roles && roles.length > 0) {
      const isAdmin = roles.some(r => r.role === "admin");
      navigate(isAdmin ? "/admin" : "/cliente");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signupSchema.parse(formData);

      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.senha,
        options: {
          data: {
            nome: validated.nome,
            cpf: validated.cpf,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado");
        } else {
          toast.error("Erro ao criar conta: " + error.message);
        }
        return;
      }

      if (data.user) {
        toast.success("Conta criada com sucesso!");
        await checkUserRoleAndRedirect(data.user.id);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao processar cadastro");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = loginSchema.parse({
        email: formData.email,
        senha: formData.senha,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.senha,
      });

      if (error) {
        if (error.message.includes("Invalid login")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error("Erro ao fazer login: " + error.message);
        }
        return;
      }

      if (data.user) {
        toast.success("Login realizado com sucesso!");
        await checkUserRoleAndRedirect(data.user.id);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao processar login");
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

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-6">
          {mode === "signup" ? "Criar Conta" : "Entrar"}
        </h2>

        {/* Form */}
        <form onSubmit={mode === "signup" ? handleSignup : handleLogin} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="nome" className="text-sm">Nome completo</Label>
                <Input
                  id="nome"
                  name="nome"
                  type="text"
                  required
                  value={formData.nome}
                  onChange={handleInputChange}
                  className="input-premium mt-1"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <Label htmlFor="cpf" className="text-sm">CPF</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  type="text"
                  required
                  maxLength={11}
                  value={formData.cpf}
                  onChange={handleInputChange}
                  className="input-premium mt-1"
                  placeholder="Apenas números"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="input-premium mt-1"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="senha" className="text-sm">Senha</Label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => navigate("/esqueci-senha")}
                  className="text-xs text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            <Input
              id="senha"
              name="senha"
              type="password"
              required
              value={formData.senha}
              onChange={handleInputChange}
              className="input-premium mt-1"
              placeholder="Mínimo 6 caracteres"
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
                Processando...
              </>
            ) : (
              mode === "signup" ? "Criar conta" : "Entrar"
            )}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => navigate(`/auth?mode=${mode === "signup" ? "login" : "signup"}`)}
            className="text-primary hover:underline"
          >
            {mode === "signup" ? "Já tem conta? Fazer login" : "Não tem conta? Criar agora"}
          </button>
        </div>

        {/* Back button */}
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Voltar
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
