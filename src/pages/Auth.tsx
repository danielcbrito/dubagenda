import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2 } from "lucide-react";
import { validateCPF, formatCPF, formatPhone, validatePhone } from "@/lib/validators";
import { SupportChatBubble } from "@/components/support/SupportChatBubble";

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
    <div className="min-h-screen relative flex items-center justify-center px-4 py-8" style={{ background: '#000000' }}>
      {/* Ambient background lights - Premium glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px]" />
      </div>

      {/* Content wrapper - Centered */}
      <div className="relative z-10 w-full max-w-[400px] animate-fade-in">
        
        {/* Logo at top - Floating */}
        <div className="flex justify-center mb-8 animate-scale-in">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <img 
              src={logoDub} 
              alt="DUB" 
              className="relative w-12 h-12 object-contain drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Luxury Glass Card - Ultra Premium Clean */}
        <div className="relative group">
          {/* Outer glow - sutil */}
          <div className="absolute -inset-[1px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent rounded-2xl blur-sm opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
          
          {/* Main card with glassmorphism - SEM BORDAS */}
          <div 
            className="relative bg-gradient-to-b from-white/[0.05] to-white/[0.02] rounded-2xl p-6 shadow-2xl overflow-hidden"
            style={{
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            {/* Top reflection line - muito sutil */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {/* Title - Menor e mais elegante */}
            <h2 className="text-xl font-medium text-white tracking-tight text-center mb-6" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
              {mode === "signup" ? "Criar Conta" : "Acesso ao Sistema"}
            </h2>

            {/* Form - Compacto e elegante */}
            <form onSubmit={mode === "signup" ? handleSignup : handleLogin} className="space-y-3.5">
              {mode === "signup" && (
                <>
                  <div>
                    <Label htmlFor="nome" className="text-xs font-medium text-white/80 mb-1.5 block">Nome completo</Label>
                    <Input
                      id="nome"
                      name="nome"
                      type="text"
                      required
                      value={formData.nome}
                      onChange={handleInputChange}
                      className="h-10 bg-white/5 border-0 text-white text-sm placeholder:text-white/40 focus:ring-1 focus:ring-primary/50 rounded-xl transition-all"
                      placeholder="Seu nome"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cpf" className="text-xs font-medium text-white/80 mb-1.5 block">CPF</Label>
                    <Input
                      id="cpf"
                      name="cpf"
                      type="text"
                      required
                      maxLength={14}
                      value={formData.cpf}
                      onChange={handleInputChange}
                      className={`h-10 bg-white/5 border-0 text-white text-sm placeholder:text-white/40 focus:ring-1 focus:ring-primary/50 rounded-xl transition-all ${cpfError ? 'ring-1 ring-destructive' : ''}`}
                      placeholder="000.000.000-00"
                    />
                    {cpfError && (
                      <p className="text-[10px] text-destructive mt-1">{cpfError}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="telefone" className="text-xs font-medium text-white/80 mb-1.5 block">Telefone</Label>
                    <Input
                      id="telefone"
                      name="telefone"
                      type="text"
                      required
                      maxLength={15}
                      value={formData.telefone}
                      onChange={handleInputChange}
                      className={`h-10 bg-white/5 border-0 text-white text-sm placeholder:text-white/40 focus:ring-1 focus:ring-primary/50 rounded-xl transition-all ${telefoneError ? 'ring-1 ring-destructive' : ''}`}
                      placeholder="(99) 99999-9999"
                    />
                    {telefoneError && (
                      <p className="text-[10px] text-destructive mt-1">{telefoneError}</p>
                    )}
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email" className="text-xs font-medium text-white/80 mb-1.5 block">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="h-10 bg-white/5 border-0 text-white text-sm placeholder:text-white/40 focus:ring-1 focus:ring-primary/50 rounded-xl transition-all"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="senha" className="text-xs font-medium text-white/80">Senha</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => navigate("/esqueci-senha")}
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors"
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
                  className="h-10 bg-white/5 border-0 text-white text-sm placeholder:text-white/40 focus:ring-1 focus:ring-primary/50 rounded-xl transition-all"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <Button 
                type="submit" 
                className="relative w-full h-10 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed mt-5"
                disabled={isLoading || cooldownTimer > 0 || (mode === "signup" && (!!cpfError || !!telefoneError))}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Processando...
                  </>
                ) : cooldownTimer > 0 ? (
                  `Aguarde ${cooldownTimer}s...`
                ) : (
                  mode === "signup" ? "Criar conta" : "Entrar"
                )}
              </Button>
            </form>

            {/* Toggle mode - Compacto */}
            <div className="mt-4 text-center">
              <button
                onClick={() => navigate(`/auth?mode=${mode === "signup" ? "login" : "signup"}`)}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                {mode === "signup" ? "Já possui conta? Fazer login" : "Não possui conta? Criar agora"}
              </button>
            </div>

            {/* Back button - Compacto */}
            <div className="mt-3 text-center">
              <button
                onClick={() => navigate("/")}
                className="text-xs text-white/50 hover:text-white/80 transition-colors duration-300"
              >
                ← Voltar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bolinha de chat de suporte */}
      <SupportChatBubble />
    </div>
  );
};

export default Auth;
