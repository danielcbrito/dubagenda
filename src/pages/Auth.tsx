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
import barbershopBg from "@/assets/barbershop-premium-bg.jpg";
import { Loader2, Mail } from "lucide-react";
import { validateCPF, formatCPF, formatPhone, validatePhone } from "@/lib/validators";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const signupSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  cpf: z.string()
    .trim()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 11, "CPF deve ter 11 dígitos")
    .refine(validateCPF, "CPF inválido. Verifique e tente novamente."),
  telefone: z.string()
    .trim()
    .transform(val => val.replace(/\D/g, ''))
    .refine(validatePhone, "Por favor, insira um telefone válido."),
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
  const [cooldownTimer, setCooldownTimer] = useState<number>(0);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: "",
    telefone: "",
    senha: "",
  });
  const [cpfError, setCpfError] = useState("");
  const [telefoneError, setTelefoneError] = useState("");

  useEffect(() => {
    // Check if coming back from email verification
    const verified = searchParams.get("verified");
    if (verified === "true") {
      toast.success("E-mail confirmado. Faça login para continuar.", {
        duration: 5000,
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email_confirmed_at) {
        checkUserRoleAndRedirect(session.user.id);
      }
    });
  }, [searchParams]);

  useEffect(() => {
    if (cooldownTimer > 0) {
      const timer = setTimeout(() => {
        setCooldownTimer(cooldownTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTimer]);

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
    let formattedValue = value;

    // Apply masks
    if (name === "cpf") {
      formattedValue = formatCPF(value);
      const cleanCPF = value.replace(/\D/g, '');
      if (cleanCPF.length === 11) {
        if (!validateCPF(cleanCPF)) {
          setCpfError("CPF inválido. Verifique e tente novamente.");
        } else {
          setCpfError("");
        }
      } else {
        setCpfError("");
      }
    } else if (name === "telefone") {
      formattedValue = formatPhone(value);
      const cleanPhone = value.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        if (!validatePhone(cleanPhone)) {
          setTelefoneError("Por favor, insira um telefone válido.");
        } else {
          setTelefoneError("");
        }
      } else {
        setTelefoneError("");
      }
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate before submitting
    if (cpfError || telefoneError) {
      toast.error("Corrija os erros antes de continuar");
      return;
    }

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
            telefone: validated.telefone,
          },
          emailRedirectTo: `${window.location.origin}/verificar-email?email=${encodeURIComponent(validated.email)}`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado");
        } else if (error.message.includes("only request this after")) {
          const seconds = parseInt(error.message.match(/\d+/)?.[0] || "10");
          setCooldownTimer(seconds);
          toast.error(`Por favor, aguarde ${seconds} segundos antes de tentar novamente.`);
        } else if (error.message.includes("rate limit")) {
          setCooldownTimer(10);
          toast.error("Muitas tentativas. Aguarde alguns segundos e tente novamente.");
        } else {
          toast.error("Erro ao criar conta. Tente novamente em alguns instantes.");
        }
        return;
      }

      if (data.user) {
        // Sempre exigir confirmação de e-mail antes do primeiro acesso
        localStorage.setItem("pendingVerificationEmail", validated.email);
        navigate(`/verificar-email?email=${encodeURIComponent(validated.email)}`);
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
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Por favor, confirme seu email antes de fazer login");
          navigate(`/verificar-email?email=${encodeURIComponent(validated.email)}`);
        } else {
          toast.error("Erro ao fazer login: " + error.message);
        }
        return;
      }

      if (data.user) {
        // Check if email is confirmed
        if (!data.user.email_confirmed_at) {
          toast.error("Por favor, confirme seu email antes de fazer login");
          navigate(`/verificar-email?email=${encodeURIComponent(validated.email)}`);
          return;
        }
        
        toast.success("Login realizado com sucesso");
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
    <div className="min-h-screen relative flex items-center justify-center p-6">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={barbershopBg} 
            alt="" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl flex items-center justify-end">
        <Card className="w-full max-w-md p-8 bg-card/95 backdrop-blur-sm border-border/50">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={logoDub} alt="Barbearia DUB" className="w-20 h-20 object-contain drop-shadow-lg" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-center mb-6 tracking-tight">
            {mode === "signup" ? "Criar Conta" : "Acesso ao Sistema"}
          </h2>

          {/* Form */}
          <form onSubmit={mode === "signup" ? handleSignup : handleLogin} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="nome" className="text-sm font-medium">Nome completo</Label>
                  <Input
                    id="nome"
                    name="nome"
                    type="text"
                    required
                    value={formData.nome}
                    onChange={handleInputChange}
                    className="input-premium mt-1.5"
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
                  <Input
                    id="cpf"
                    name="cpf"
                    type="text"
                    required
                    maxLength={14}
                    value={formData.cpf}
                    onChange={handleInputChange}
                    className={`input-premium mt-1.5 ${cpfError ? 'border-destructive' : ''}`}
                    placeholder="000.000.000-00"
                  />
                  {cpfError && (
                    <p className="text-xs text-destructive mt-1">{cpfError}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="telefone" className="text-sm font-medium">Telefone</Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    type="text"
                    required
                    maxLength={15}
                    value={formData.telefone}
                    onChange={handleInputChange}
                    className={`input-premium mt-1.5 ${telefoneError ? 'border-destructive' : ''}`}
                    placeholder="(99) 99999-9999"
                  />
                  {telefoneError && (
                    <p className="text-xs text-destructive mt-1">{telefoneError}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="input-premium mt-1.5"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="senha" className="text-sm font-medium">Senha</Label>
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
                className="input-premium mt-1.5"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-primary hover:bg-primary/90 font-medium"
              disabled={isLoading || cooldownTimer > 0 || (mode === "signup" && (!!cpfError || !!telefoneError))}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : cooldownTimer > 0 ? (
                `Aguarde ${cooldownTimer}s...`
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
              {mode === "signup" ? "Já possui conta? Fazer login" : "Não possui conta? Criar agora"}
            </button>
          </div>

          {/* Back button */}
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Voltar
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
