import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Eye, EyeOff, User, Mail, Phone, Lock, CreditCard, ArrowLeft } from "lucide-react";
import { formatPhone, validatePhone, formatCPF, validateCPF } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { SupportChatBubble } from "@/components/support/SupportChatBubble";
import logoDub from "@/assets/logo-dub.png";
import { motion } from "framer-motion";

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
    .refine(val => val.length === 11, "CPF é obrigatório.")
    .refine(validateCPF, "CPF inválido."),
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
      if (isAdmin) {
        await supabase.auth.signOut();
        toast.error("Este aplicativo é exclusivo para clientes. Acesse o app administrativo para gerenciar.", {
          duration: 5000,
        });
        return;
      }
    }
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

      try {
        const { data: dupData, error: dupError } = await supabase.functions.invoke('check-duplicate-signup', {
          body: {
            cpf: validated.cpf,
            telefone: validated.telefone,
            email: validated.email,
          }
        });

        if (!dupError && dupData?.duplicates?.length > 0) {
          const msgs: Record<string, string> = {
            cpf: "Este CPF já está cadastrado.",
            telefone: "Este telefone já está cadastrado.",
            email: "Este email já está cadastrado.",
          };
          const firstDup = dupData.duplicates[0];
          toast.error(msgs[firstDup] || "Dados já cadastrados.");
          if (firstDup === 'cpf') setCpfError(msgs.cpf);
          if (firstDup === 'telefone') setTelefoneError(msgs.telefone);
          setIsLoading(false);
          return;
        }
      } catch (dupErr) {
        console.error("Erro ao verificar duplicidade:", dupErr);
      }

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

  const inputClasses = "h-12 pl-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm";

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-background">
      {/* Back button - absolute so it doesn't affect centering */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="absolute top-0 left-0 pt-[calc(env(safe-area-inset-top)+1rem)] pl-6 z-10"
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[13px]">Voltar</span>
        </button>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 overflow-y-auto">

        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center mb-6"
        >
          <img
            src={logoDub}
            alt="DUB"
            className="w-14 h-14 object-contain mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
            {isSignup ? "Criar conta" : "Bem-vindo de volta"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            {isSignup
              ? "Preencha seus dados para começar"
              : "Entre com seu email e senha"}
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={isSignup ? handleSignup : handleLogin}
          className="w-full max-w-sm mx-auto space-y-4"
        >
          {isSignup && (
            <>
              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                  <Input
                    name="nome"
                    type="text"
                    required
                    value={formData.nome}
                    onChange={handleInputChange}
                    className={inputClasses}
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              {/* Telefone */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                  <Input
                    name="telefone"
                    type="text"
                    required
                    maxLength={15}
                    value={formData.telefone}
                    onChange={handleInputChange}
                    className={`${inputClasses} ${telefoneError ? 'border-destructive/50 focus:border-destructive/50' : ''}`}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                {telefoneError && (
                  <p className="text-[11px] text-destructive pl-1">{telefoneError}</p>
                )}
              </div>

              {/* CPF */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
                  CPF
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                  <Input
                    name="cpf"
                    type="text"
                    required
                    maxLength={14}
                    value={formData.cpf}
                    onChange={handleInputChange}
                    className={`${inputClasses} ${cpfError ? 'border-destructive/50 focus:border-destructive/50' : ''}`}
                    placeholder="000.000.000-00"
                  />
                </div>
                {cpfError && (
                  <p className="text-[11px] text-destructive pl-1">{cpfError}</p>
                )}
              </div>
            </>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
              <Input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className={inputClasses}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Senha
              </label>
              {!isSignup && (
                <button
                  type="button"
                  onClick={() => navigate("/esqueci-senha")}
                  className="text-[11px] text-primary/80 hover:text-primary transition-colors font-medium"
                >
                  Esqueci a senha
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
              <Input
                name="senha"
                type={showPassword ? "text" : "password"}
                required
                value={formData.senha}
                onChange={handleInputChange}
                className={`${inputClasses} pr-11`}
                placeholder={isSignup ? "Mínimo 6 caracteres" : "Sua senha"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-[50px] mt-2 rounded-xl text-[14px] font-semibold transition-all duration-200"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-glow-red)",
            }}
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
        </motion.form>

        {/* Toggle Mode */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center mt-6 pb-8"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
        >
          <p className="text-[13px] text-muted-foreground">
            {isSignup ? "Já tem conta?" : "Não tem conta?"}
            <button
              type="button"
              onClick={() => navigate(`/auth?mode=${isSignup ? "login" : "signup"}`)}
              className="ml-1.5 text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              {isSignup ? "Entrar" : "Criar agora"}
            </button>
          </p>
        </motion.div>
      </div>

      <SupportChatBubble />
    </div>
  );
};

export default Auth;
