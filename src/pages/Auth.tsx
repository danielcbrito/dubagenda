import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Eye, EyeOff, User, Mail, Phone, Lock, CreditCard } from "lucide-react";
import { formatPhone, validatePhone, formatCPF, validateCPF } from "@/lib/validators";
import { SupportChatBubble } from "@/components/support/SupportChatBubble";

const signupSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  telefone: z.string()
    .trim()
    .transform(val => val.replace(/\D/g, ''))
    .refine(validatePhone, "Por favor, insira um telefone válido."),
  cpf: z.string()
    .trim()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 0 || validateCPF(val), "CPF inválido."),
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
    telefone: "",
    cpf: "",
    senha: "",
  });
  const [telefoneError, setTelefoneError] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const verified = searchParams.get("verified");
    if (verified === "true" || verified === "whatsapp") {
      toast.success("Conta confirmada com sucesso! Faça login para continuar.", {
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
      
      // Bloquear acesso de admins - este app é exclusivo para clientes
      if (isAdmin) {
        await supabase.auth.signOut();
        toast.error("Este aplicativo é exclusivo para clientes. Acesse o app administrativo para gerenciar.", {
          duration: 5000,
        });
        return;
      }
    }
    
    // Redirecionar clientes para área do cliente
    navigate("/cliente");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === "telefone") {
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

    if (name === "cpf") {
      formattedValue = formatCPF(value);
      const cleanCpf = value.replace(/\D/g, '');
      if (cleanCpf.length === 11) {
        if (!validateCPF(cleanCpf)) {
          setCpfError("CPF inválido.");
        } else {
          setCpfError("");
        }
      } else {
        setCpfError("");
      }
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (telefoneError || cpfError) {
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
            telefone: validated.telefone,
            cpf: validated.cpf,
          },
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
        // Redirecionar diretamente para verificação via WhatsApp
        try {
          const { data: whatsappData, error: whatsappError } = await supabase.functions.invoke('whatsapp-verification', {
            body: {
              action: 'generate',
              user_id: data.user.id,
              phone: validated.telefone,
              user_name: validated.nome,
              user_email: validated.email,
            }
          });

          if (whatsappError) throw whatsappError;

          if (whatsappData?.success) {
            toast.success("Código enviado para seu WhatsApp!");
            navigate(`/verificar-whatsapp?user_id=${data.user.id}&phone=${encodeURIComponent(validated.telefone)}`);
          } else {
            toast.error("Erro ao enviar código. Tente novamente.");
            navigate(`/verificar-whatsapp?user_id=${data.user.id}&phone=${encodeURIComponent(validated.telefone)}`);
          }
        } catch (whatsappErr) {
          console.error("Erro ao gerar código WhatsApp:", whatsappErr);
          toast.info("Cadastro realizado! Confirme via WhatsApp.");
          navigate(`/verificar-whatsapp?user_id=${data.user.id}&phone=${encodeURIComponent(validated.telefone)}`);
        }
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
          toast.error("Por favor, confirme seu cadastro antes de fazer login");
        } else {
          toast.error("Erro ao fazer login: " + error.message);
        }
        return;
      }

      if (data.user) {
        if (!data.user.email_confirmed_at) {
          toast.error("Por favor, confirme seu cadastro antes de fazer login");
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

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-black">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 overflow-y-auto">
        <div className="w-full max-w-[380px] relative z-10">
          
          {/* Card */}
          <div 
            className="rounded-2xl p-5 sm:p-6 border border-white/[0.08]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                {isSignup ? "Criar conta" : "Entrar"}
              </h1>
              <p className="mt-1.5 text-sm text-white/50">
                {isSignup 
                  ? "Preencha seus dados" 
                  : "Entre com suas credenciais"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-3">
              
              {isSignup && (
                <>
                  {/* Nome */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70 block">
                      Nome completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        name="nome"
                        type="text"
                        required
                        value={formData.nome}
                        onChange={handleInputChange}
                        className="h-11 pl-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                        placeholder="Seu nome"
                      />
                    </div>
                  </div>

                  {/* Telefone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70 block">
                      WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        name="telefone"
                        type="text"
                        required
                        maxLength={15}
                        value={formData.telefone}
                        onChange={handleInputChange}
                        className={`h-11 pl-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm ${telefoneError ? 'border-destructive/50 focus:border-destructive/50' : ''}`}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    {telefoneError && (
                      <p className="text-xs text-destructive pl-1">{telefoneError}</p>
                    )}
                  </div>

                  {/* CPF */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70 block">
                      CPF
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        name="cpf"
                        type="text"
                        maxLength={14}
                        value={formData.cpf}
                        onChange={handleInputChange}
                        className={`h-11 pl-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm ${cpfError ? 'border-destructive/50 focus:border-destructive/50' : ''}`}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    {cpfError && (
                      <p className="text-xs text-destructive pl-1">{cpfError}</p>
                    )}
                  </div>
                </>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="h-11 pl-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/70">
                    Senha
                  </label>
                  {!isSignup && (
                    <button
                      type="button"
                      onClick={() => navigate("/esqueci-senha")}
                      className="text-xs text-primary/80 hover:text-primary transition-colors"
                    >
                      Esqueci a senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    name="senha"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.senha}
                    onChange={handleInputChange}
                    className="h-11 pl-10 pr-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                    placeholder={isSignup ? "Mínimo 6 caracteres" : "Sua senha"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-11 mt-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                disabled={isLoading || cooldownTimer > 0 || (isSignup && (!!telefoneError || !!cpfError))}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isSignup ? "Criando..." : "Entrando..."}
                  </span>
                ) : cooldownTimer > 0 ? (
                  `Aguarde ${cooldownTimer}s`
                ) : (
                  isSignup ? "Criar conta" : "Entrar"
                )}
              </Button>
            </form>

            {/* Toggle Mode */}
            <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
              <p className="text-sm text-white/40">
                {isSignup ? "Já tem conta?" : "Não tem conta?"}
                <button
                  type="button"
                  onClick={() => navigate(`/auth?mode=${isSignup ? "login" : "signup"}`)}
                  className="ml-1.5 text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {isSignup ? "Entrar" : "Criar agora"}
                </button>
              </p>
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              ← Voltar ao início
            </button>
          </div>
        </div>
      </div>

      {/* Support Chat */}
      <SupportChatBubble />
    </div>
  );
};

export default Auth;
