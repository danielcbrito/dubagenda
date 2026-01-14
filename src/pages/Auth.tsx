import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, Eye, EyeOff, User, Mail, Phone, Lock, CreditCard } from "lucide-react";
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
      navigate(isAdmin ? "/admin" : "/cliente");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

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
              user_cpf: validated.cpf,
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
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.4) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 flex items-center justify-center px-5 py-8 sm:py-12 overflow-y-auto">
        <div className="w-full max-w-[400px] relative z-10">
          
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-full opacity-60"
                style={{
                  background: 'radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                  transform: 'scale(1.5)',
                }}
              />
              <img 
                src={logoDub} 
                alt="DUB" 
                className="relative w-16 h-16 sm:w-20 sm:h-20 object-contain"
              />
            </div>
          </div>

          {/* Card */}
          <div className="relative">
            {/* Card Border Glow */}
            <div 
              className="absolute -inset-px rounded-2xl opacity-50"
              style={{
                background: 'linear-gradient(180deg, hsl(var(--primary) / 0.3) 0%, transparent 50%)',
              }}
            />
            
            {/* Card Content */}
            <div 
              className="relative rounded-2xl p-6 sm:p-8 border border-white/[0.08]"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Top Highlight */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-[28px] font-semibold text-white tracking-tight">
                  {isSignup ? "Criar conta" : "Bem-vindo de volta"}
                </h1>
                <p className="mt-2 text-sm text-white/50">
                  {isSignup 
                    ? "Preencha seus dados para começar" 
                    : "Entre com suas credenciais"}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
                
                {isSignup && (
                  <>
                    {/* Nome */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80 block">
                        Nome completo
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30" />
                        <Input
                          name="nome"
                          type="text"
                          required
                          value={formData.nome}
                          onChange={handleInputChange}
                          className="h-12 pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                          placeholder="Seu nome"
                        />
                      </div>
                    </div>

                    {/* CPF */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80 block">
                        CPF
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30" />
                        <Input
                          name="cpf"
                          type="text"
                          required
                          maxLength={14}
                          value={formData.cpf}
                          onChange={handleInputChange}
                          className={`h-12 pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all ${cpfError ? 'border-destructive/50 focus:border-destructive/50' : ''}`}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      {cpfError && (
                        <p className="text-xs text-destructive pl-1">{cpfError}</p>
                      )}
                    </div>

                    {/* Telefone */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80 block">
                        WhatsApp
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30" />
                        <Input
                          name="telefone"
                          type="text"
                          required
                          maxLength={15}
                          value={formData.telefone}
                          onChange={handleInputChange}
                          className={`h-12 pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all ${telefoneError ? 'border-destructive/50 focus:border-destructive/50' : ''}`}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      {telefoneError && (
                        <p className="text-xs text-destructive pl-1">{telefoneError}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 block">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30" />
                    <Input
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="h-12 pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white/80">
                      Senha
                    </label>
                    {!isSignup && (
                      <button
                        type="button"
                        onClick={() => navigate("/esqueci-senha")}
                        className="text-xs text-primary/80 hover:text-primary transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30" />
                    <Input
                      name="senha"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.senha}
                      onChange={handleInputChange}
                      className="h-12 pl-11 pr-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                      placeholder={isSignup ? "Mínimo 6 caracteres" : "Sua senha"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-[18px] h-[18px]" />
                      ) : (
                        <Eye className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full h-12 mt-6 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50"
                  disabled={isLoading || cooldownTimer > 0 || (isSignup && (!!cpfError || !!telefoneError))}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isSignup ? "Criando conta..." : "Entrando..."}
                    </span>
                  ) : cooldownTimer > 0 ? (
                    `Aguarde ${cooldownTimer}s`
                  ) : (
                    isSignup ? "Criar conta" : "Entrar"
                  )}
                </Button>
              </form>

              {/* Toggle Mode */}
              <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
                <p className="text-sm text-white/40">
                  {isSignup ? "Já tem uma conta?" : "Não tem conta?"}
                  <button
                    type="button"
                    onClick={() => navigate(`/auth?mode=${isSignup ? "login" : "signup"}`)}
                    className="ml-1.5 text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    {isSignup ? "Fazer login" : "Criar agora"}
                  </button>
                </p>
              </div>
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
