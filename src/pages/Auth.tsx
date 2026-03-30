import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Eye, EyeOff, Mail } from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
import { SupportChatBubble } from "@/components/support/SupportChatBubble";
import { motion, AnimatePresence } from "framer-motion";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(1, "Senha é obrigatória");

type AuthStep = "email" | "password" | "magic_sent";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const signupOrigin = searchParams.get("origin") || "dub_exclusive";
  const isSignup = mode === "signup";

  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-check session + prefill email from redirects
  useEffect(() => {
    const verified = searchParams.get("verified");
    const prefilledEmail = searchParams.get("email");

    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }

    if (verified === "true" || verified === "whatsapp") {
      toast.success("Conta confirmada com sucesso! Faça login para continuar.", { duration: 5000 });
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email_confirmed_at) {
        checkUserRoleAndRedirect(session.user.id);
      }
    });
  }, [searchParams]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownTimer > 0) {
      const t = setTimeout(() => setCooldownTimer(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldownTimer]);

  // Focus password when step changes
  useEffect(() => {
    if (step === "password") {
      setTimeout(() => {
        passwordRef.current?.focus();
        // Scroll into view to avoid keyboard covering
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 350);
    }
  }, [step]);

  const checkUserRoleAndRedirect = async (userId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roles && roles.length > 0) {
      const isAdmin = roles.some(r => r.role === "admin");
      if (isAdmin) {
        await supabase.auth.signOut();
        toast.error("Este aplicativo é exclusivo para clientes. Acesse o app administrativo para gerenciar.", { duration: 5000 });
        return;
      }
    }

    const preSelectedTenant = searchParams.get("tenant");
    if (preSelectedTenant) {
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("nome")
        .eq("id", preSelectedTenant)
        .single();

      const tenantNormalized = tenantData?.nome
        ? tenantData.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        : "";
      const isDub = tenantNormalized === "barbeariadub";

      await supabase
        .from("profiles")
        .update(isDub
          ? { barbearia_preferida_id: preSelectedTenant, signup_origin: "dub_exclusive" }
          : { barbearia_preferida_id: preSelectedTenant, signup_origin: "discover" })
        .eq("id", userId);
      navigate("/cliente");
      return;
    }

    const currentOrigin = searchParams.get("origin") || signupOrigin;
    if (currentOrigin === "discover") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("barbearia_preferida_id")
        .eq("id", userId)
        .single();
      if (!profile?.barbearia_preferida_id) {
        navigate("/escolher-barbearia");
        return;
      }
    }

    navigate("/cliente");
  };

  // Auto-detect email completion and reveal password
  const emailLooksComplete = (() => {
    const trimmed = email.trim();
    if (trimmed.length < 5) return false;
    const atIndex = trimmed.indexOf("@");
    if (atIndex < 1) return false;
    const domain = trimmed.slice(atIndex + 1);
    return domain.includes(".") && domain.lastIndexOf(".") < domain.length - 1;
  })();

  // Auto-advance to password step when email looks valid (login only)
  useEffect(() => {
    if (!isSignup && emailLooksComplete && step === "email") {
      setStep("password");
    }
    if (!isSignup && !emailLooksComplete && step === "password") {
      setStep("email");
      setSenha("");
    }
  }, [emailLooksComplete, isSignup]);

  // Step 1: validate email and advance
  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
    } catch {
      toast.error("Digite um email válido");
      return;
    }

    if (isSignup) {
      handleMagicLink();
    } else if (step === "email") {
      setStep("password");
    } else {
      // Already on password step, submit the form
      handlePasswordSubmit(e);
    }
  };

  // Signup: send magic link (with duplicate check)
  const handleMagicLink = async () => {
    setIsLoading(true);
    try {
      const validated = emailSchema.parse(email);

      const { data: dupData, error: duplicateCheckError } = await supabase.functions.invoke("check-duplicate-signup", {
        body: { email: validated },
      });

      if (duplicateCheckError) {
        throw duplicateCheckError;
      }

      if (dupData?.duplicateClientAccount || dupData?.duplicates?.includes("email")) {
        const message = "Já existe uma conta de cliente com esse e-mail. Faça login para continuar.";
        setStep("email");
        setSenha("");
        setLoginError(message);
        toast.error(message, { duration: 5000 });
        navigate(`/auth?mode=login&email=${encodeURIComponent(validated)}`, { replace: true });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: validated,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { signup_origin: signupOrigin },
        },
      });

      if (error) {
        if (error.message.includes("rate limit") || error.message.includes("only request this after")) {
          const seconds = parseInt(error.message.match(/\d+/)?.[0] || "30");
          setCooldownTimer(seconds);
          toast.error(`Aguarde ${seconds} segundos antes de tentar novamente.`);
        } else {
          toast.error("Erro ao enviar link. Tente novamente.");
        }
        return;
      }

      setStep("magic_sent");
      toast.success("Link de acesso enviado para seu email!");
    } catch {
      toast.error("Erro ao processar cadastro");
    } finally {
      setIsLoading(false);
    }
  };

  // Login: submit password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);

    try {
      passwordSchema.parse(senha);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) {
        const msg = error.message.includes("Invalid login")
          ? "Email ou senha incorretos"
          : error.message.includes("Email not confirmed")
            ? "Confirme seu cadastro antes de fazer login"
            : "Erro ao fazer login";
        setLoginError(msg);
        toast.error(msg);
        return;
      }

      if (data.user) {
        if (!data.user.email_confirmed_at) {
          toast.error("Confirme seu cadastro antes de fazer login");
          return;
        }
        toast.success("Login realizado com sucesso");
        await checkUserRoleAndRedirect(data.user.id);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Erro ao processar login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleAppleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleBack = () => {
    if (step === "password" || step === "magic_sent") {
      setStep("email");
      setSenha("");
      setLoginError(null);
    } else {
      navigate("/");
    }
  };

  const inputClasses =
    "h-14 bg-muted/40 border-border/60 text-foreground placeholder:text-muted-foreground/40 rounded-2xl focus:border-foreground/30 focus:ring-0 transition-all text-[15px] px-5";

  // ── Magic link sent screen ──
  if (step === "magic_sent") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pt-[calc(env(safe-area-inset-top)+1rem)] pl-6 z-10"
        >
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BackArrow size={18} />
            <span className="text-[13px]">Voltar</span>
          </button>
        </motion.div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center max-w-sm"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight mb-2">
              Verifique seu email
            </h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-6">
              Enviamos um link de acesso para{" "}
              <strong className="text-foreground">{email}</strong>.
              <br />
              Clique no link para entrar no aplicativo.
            </p>
            <Button
              variant="outline"
              className="rounded-xl text-[13px]"
              onClick={handleBack}
            >
              Usar outro email
            </Button>
          </motion.div>
        </div>
        <SupportChatBubble />
      </div>
    );
  }

  // ── Main auth screen ──
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Back */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex-shrink-0 pt-[calc(env(safe-area-inset-top)+1rem)] pl-6 z-10"
      >
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackArrow size={18} />
          <span className="text-[13px]">Voltar</span>
        </button>
      </motion.div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 flex flex-col justify-center px-6 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="w-full max-w-sm mx-auto py-8">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-8"
          >
            <h1 className="text-[22px] font-bold text-foreground tracking-tight">
              {isSignup ? "Entrar ou criar conta" : "Entrar na sua conta"}
            </h1>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={step === "password" ? handlePasswordSubmit : handleEmailContinue}
            className="space-y-3"
          >
            {/* Email */}
            <Input
              name="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClasses}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              disabled={step === "password"}
            />

            {/* Password — animated reveal */}
            <AnimatePresence>
              {step === "password" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Input
                        ref={passwordRef}
                        name="senha"
                        type={showPassword ? "text" : "password"}
                        required
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        className={`${inputClasses} pr-12`}
                        placeholder="Sua senha"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigate("/esqueci-senha")}
                        className="text-[12px] text-primary/80 hover:text-primary transition-colors font-medium"
                      >
                        Esqueci a senha
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {loginError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[13px] text-destructive text-center font-medium"
                >
                  {loginError}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Continue */}
            <Button
              type="submit"
              className="w-full h-14 rounded-2xl text-[15px] font-semibold bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] transition-all duration-200"
              disabled={isLoading || cooldownTimer > 0}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {step === "password" ? "Entrando..." : "Enviando..."}
                </span>
              ) : cooldownTimer > 0 ? (
                `Aguarde ${cooldownTimer}s`
              ) : (
                "Continuar"
              )}
            </Button>



          </motion.form>

          {/* Separator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="flex items-center gap-4 my-5"
          >
            <div className="flex-1 h-px bg-border" />
            <span className="text-[12px] text-muted-foreground/50 lowercase">ou</span>
            <div className="flex-1 h-px bg-border" />
          </motion.div>

          {/* OAuth */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-card text-foreground font-medium text-[15px] border border-border/60 active:scale-[0.98] transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar com Google
            </button>

            <button
              type="button"
              onClick={handleAppleLogin}
              className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-foreground text-background font-medium text-[15px] border border-foreground active:scale-[0.98] transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Continuar com Apple
            </button>
          </motion.div>

          {/* Toggle mode */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-center mt-8 pb-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
          >
            <p className="text-[13px] text-muted-foreground">
              {isSignup ? "Já tem conta?" : "Não tem conta?"}
              <button
                type="button"
                onClick={() => {
                  if (isSignup) {
                    // Already on signup, go to login
                    setStep("email");
                    setSenha("");
                    setLoginError(null);
                    navigate("/auth?mode=login");
                  } else {
                    // From login, redirect to barbershop discovery flow
                    navigate("/escolher-barbearia");
                  }
                }}
                className="ml-1.5 text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                {isSignup ? "Entrar" : "Criar agora"}
              </button>
            </p>
          </motion.div>
        </div>
      </div>

      <SupportChatBubble />
    </div>
  );
};

export default Auth;
