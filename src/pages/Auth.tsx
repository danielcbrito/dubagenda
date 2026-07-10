import { useState, useEffect, useRef, useCallback } from "react";
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
import { getLastAccount, saveLastAccount, clearLastAccount, type LastAccount } from "@/utils/lastAccount";
import { getVerifiedAuthUser } from "@/utils/authSession";
import logoDub from "@/assets/logo-dub.png";

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

  // Real-time duplicate detection state
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Login sheet state
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  // Quick-access "last account" card
  const [lastAccount, setLastAccount] = useState<LastAccount | null>(null);
  useEffect(() => {
    if (!isSignup) setLastAccount(getLastAccount());
  }, [isSignup]);

  // ── Signup multi-step (WhatsApp OTP first, then email+password) ──
  type SignupStep = "phone" | "otp" | "email" | "password";
  const [signupStep, setSignupStep] = useState<SignupStep>("phone");
  const [phoneDigits, setPhoneDigits] = useState(""); // BR digits (10 or 11, no country code)
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [signupBusy, setSignupBusy] = useState(false);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-check session + prefill email from redirects
  useEffect(() => {
    const verified = searchParams.get("verified");
    const prefilledEmail = searchParams.get("email");
    const refCode = searchParams.get("ref");

    // Persist referral code across the entire signup flow (Auth → CompletarPerfil → EscolherBarbearia).
    // Kept in sessionStorage so it survives page reloads (e.g. email confirmation redirect).
    if (refCode && refCode.trim().length > 0) {
      const codeUp = refCode.trim().toUpperCase();
      try {
        sessionStorage.setItem("pending_referral_code", codeUp);

        // Gera/recupera um session id estável por navegador para vincular
        // o clique (anônimo) ao futuro cadastro do mesmo usuário.
        let sid = localStorage.getItem("dub_ref_session_id") || "";
        if (!sid) {
          sid =
            (crypto as any)?.randomUUID?.() ||
            `sid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          localStorage.setItem("dub_ref_session_id", sid);
        }
        sessionStorage.setItem("pending_referral_session_id", sid);

        // Registra o clique em tempo real (aparece como "Entrou no link"
        // no painel de indicações do indicador). Silencioso em caso de erro.
        supabase.rpc("registrar_click_indicacao", {
          p_codigo: codeUp,
          p_session_id: sid,
        }).then(() => {}, () => {});
      } catch {
        /* ignore storage failures */
      }
    }

    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }

    if (verified === "true" || verified === "whatsapp") {
      toast.success("Conta confirmada com sucesso! Faça login para continuar.", { duration: 5000 });
    }
    getVerifiedAuthUser().then((user) => {
      if (user?.email_confirmed_at) {
        checkUserRoleAndRedirect(user.id);
      }
    });
  }, [searchParams]);

  // Open login sheet automatically in login mode
  useEffect(() => {
    if (!isSignup) {
      setShowLoginSheet(true);
    } else {
      setShowLoginSheet(false);
    }
  }, [isSignup]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownTimer > 0) {
      const t = setTimeout(() => setCooldownTimer(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldownTimer]);

  // Focus password when login sheet shows
  useEffect(() => {
    if (showLoginSheet && step === "password") {
      setTimeout(() => passwordRef.current?.focus(), 350);
    }
  }, [showLoginSheet, step]);

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

  // Email looks complete check
  const emailLooksComplete = (() => {
    const trimmed = email.trim();
    if (trimmed.length < 5) return false;
    const atIndex = trimmed.indexOf("@");
    if (atIndex < 1) return false;
    const domain = trimmed.slice(atIndex + 1);
    return domain.includes(".") && domain.lastIndexOf(".") < domain.length - 1;
  })();

  // Real-time duplicate email check (signup mode only)
  const checkEmailDuplicate = useCallback(async (emailValue: string) => {
    try {
      const validated = emailSchema.parse(emailValue);
      setCheckingEmail(true);
      const { data } = await supabase.functions.invoke("check-duplicate-signup", {
        body: { email: validated },
      });
      if (data?.duplicateClientAccount || data?.duplicates?.includes("email")) {
        setEmailExists(true);
      } else {
        setEmailExists(false);
      }
    } catch {
      setEmailExists(false);
    } finally {
      setCheckingEmail(false);
    }
  }, []);

  // Debounced email check on input change
  useEffect(() => {
    if (!isSignup) return;
    setEmailExists(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (emailLooksComplete) {
      debounceRef.current = setTimeout(() => {
        checkEmailDuplicate(email);
      }, 600);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [email, isSignup, emailLooksComplete, checkEmailDuplicate]);

  // Signup: send magic link
  const handleMagicLink = async () => {
    setIsLoading(true);
    try {
      const validated = emailSchema.parse(email);

      // Double-check duplicate before sending
      const { data: dupData, error: duplicateCheckError } = await supabase.functions.invoke("check-duplicate-signup", {
        body: { email: validated },
      });

      if (duplicateCheckError) throw duplicateCheckError;

      if (dupData?.duplicateClientAccount || dupData?.duplicates?.includes("email")) {
        setEmailExists(true);
        toast.error("Este email já possui uma conta. Faça login.", { duration: 4000 });
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
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message || "Email inválido");
      } else {
        toast.error("Não foi possível validar esse e-mail agora. Tente novamente.");
      }
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
      emailSchema.parse(email);
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
        // Persist non-sensitive metadata for "Entrar como <Nome>" quick-access card.
        supabase
          .from("profiles")
          .select("nome, avatar_url")
          .eq("id", data.user.id)
          .maybeSingle()
          .then(({ data: p }) => {
            saveLastAccount({
              nome: p?.nome ?? data.user.user_metadata?.nome ?? null,
              email: data.user.email ?? email.trim(),
              avatar_url: p?.avatar_url ?? null,
            });
          }, () => {});
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

  // Signup form submit
  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailExists) {
      // Redirect to login
      navigate("/auth?mode=login&email=" + encodeURIComponent(email.trim()));
      return;
    }
    handleMagicLink();
  };

  // ─── Signup por WhatsApp OTP ───────────────────────────────
  const maskPhone = (digits: string) => {
    const d = digits.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleSendOtp = async () => {
    const digits = phoneDigits.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      toast.error("Informe um WhatsApp válido (DDD + número)");
      return;
    }
    setSignupBusy(true);
    try {
      const existingUser = await getVerifiedAuthUser();
      if (existingUser) {
        await checkUserRoleAndRedirect(existingUser.id);
        return;
      }

      const { data, error } = await supabase.functions.invoke("whatsapp-verification", {
        body: { action: "signup_send", phone: digits },
      });
      if (error) throw error;
      if (!data?.success) {
        if (data?.cooldown_remaining) setOtpCooldown(data.cooldown_remaining);
        toast.error(data?.error || "Não foi possível enviar o código");
        return;
      }
      setOtpCode("");
      setSignupStep("otp");
      setOtpCooldown(60);
      toast.success("Código enviado para seu WhatsApp");
    } catch (err: any) {
      const context = err?.context ? await err.context.text().catch(() => "") : "";
      try {
        const parsed = context ? JSON.parse(context) : null;
        toast.error(parsed?.error || "Erro ao enviar o código. Tente novamente.");
      } catch {
        toast.error("Erro ao enviar o código. Tente novamente.");
      }
    } finally {
      setSignupBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Digite os 6 dígitos");
      return;
    }
    setSignupBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-verification", {
        body: { action: "signup_verify", phone: phoneDigits.replace(/\D/g, ""), code: otpCode },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Código inválido");
        return;
      }
      setOtpToken(data.verification_token);
      setSignupStep("email");
      toast.success("WhatsApp verificado!");
    } catch {
      toast.error("Erro ao verificar o código");
    } finally {
      setSignupBusy(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupBusy(true);
    try {
      const validEmail = emailSchema.parse(email);
      if (senha.length < 6) {
        toast.error("A senha precisa ter ao menos 6 caracteres");
        return;
      }

      const { data: dup } = await supabase.functions.invoke("check-duplicate-signup", {
        body: { email: validEmail },
      });
      if (dup?.duplicateClientAccount || dup?.duplicates?.includes("email")) {
        setEmailExists(true);
        toast.error("Este email já possui uma conta. Faça login.");
        return;
      }

      const phoneNormalized = "55" + phoneDigits.replace(/\D/g, "");

      // Cria a conta via edge function (admin API) — sem envio de email de confirmação.
      const { data: createRes, error: createErr } = await supabase.functions.invoke(
        "whatsapp-verification",
        {
          body: {
            action: "signup_create_account",
            phone: phoneDigits.replace(/\D/g, ""),
            verification_token: otpToken,
            email: validEmail,
            password: senha,
            signup_origin: signupOrigin,
            nome: validEmail.split("@")[0],
          },
        }
      );

      if (createErr || !createRes?.success) {
        const msg = createRes?.error || createErr?.message || "";
        if (createRes?.code === "email_exists" || /already|exists|registered|já possui/i.test(msg)) {
          setEmailExists(true);
          toast.error("Este email já possui uma conta. Faça login.");
        } else {
          toast.error(msg || "Erro ao criar conta");
        }
        return;
      }

      const userId = createRes.user_id as string;

      // Registra a indicação imediatamente — não depende de CompletarPerfil.
      try {
        const pendingRef =
          sessionStorage.getItem("pending_referral_code") ||
          searchParams.get("ref") ||
          "";
        if (pendingRef) {
          const sid =
            sessionStorage.getItem("pending_referral_session_id") ||
            localStorage.getItem("dub_ref_session_id") ||
            null;
          await supabase.rpc("registrar_indicacao", {
            p_indicado_id: userId,
            p_codigo: pendingRef.trim().toUpperCase(),
            p_session_id: sid,
          });
          sessionStorage.removeItem("pending_referral_code");
          sessionStorage.removeItem("pending_referral_session_id");
        }
      } catch (err) {
        console.warn("Falha ao registrar indicação:", err);
      }

      // Login imediato com senha — sem passar por email de confirmação.
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: validEmail,
        password: senha,
      });
      if (signInErr || !signInData.session) {
        toast.error("Conta criada. Faça login para continuar.");
        navigate("/auth?mode=login&email=" + encodeURIComponent(validEmail));
        return;
      }
      toast.success("Conta criada!");
      await checkUserRoleAndRedirect(signInData.user.id);
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0]?.message || "Dados inválidos");
      else toast.error("Erro ao criar conta");
    } finally {
      setSignupBusy(false);
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

  const inputClasses =
    "h-14 bg-background border border-primary text-foreground placeholder:text-muted-foreground/50 rounded-xl focus:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 outline-none transition-colors text-[15px] px-4";

  // Keyboard offset: on mobile, when the on-screen keyboard opens, lift the
  // footer (Continue button + hint) so it stays right above the keyboard.
  const [kbOffset, setKbOffset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbOffset(offset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Back handler with per-step logic
  const handleBack = () => {
    if (step === "magic_sent") {
      setStep("email");
      setSenha("");
      setLoginError(null);
      return;
    }
    if (isSignup) {
      if (signupStep === "password") return setSignupStep("email");
      if (signupStep === "email") return setSignupStep("otp");
      if (signupStep === "otp") return setSignupStep("phone");
      return navigate("/");
    }
    if (step === "password") {
      setStep("email");
      setSenha("");
      setLoginError(null);
      return;
    }
    navigate("/");
  };

  // ─────────── Shared "One-Question" shell ───────────
  const Shell: React.FC<{
    headerTitle: string;
    title: string;
    subtitle?: React.ReactNode;
    stepKey: string;
    children: React.ReactNode;
    footer: React.ReactNode;
    bottomHint?: React.ReactNode;
  }> = ({ headerTitle, title, subtitle, stepKey, children, footer, bottomHint }) => (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Top bar: back + centered title */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)", paddingBottom: "1rem" }}
      >
        <button
          type="button"
          onClick={handleBack}
          className="absolute left-3 p-2 -m-2 text-foreground hover:text-foreground/70 transition-colors"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}
          aria-label="Voltar"
        >
          <BackArrow size={20} />
        </button>
        <h2 className="text-[15px] font-semibold text-foreground">{headerTitle}</h2>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-6 pt-2 overflow-y-auto overscroll-contain">
        <img
          src={logoDub}
          alt="DUB"
          className="w-14 h-14 object-contain mb-8"
          style={{ filter: "brightness(0)" }}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={stepKey}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-[24px] font-bold text-foreground tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[14px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                {subtitle}
              </p>
            )}
            {!subtitle && <div className="mb-6" />}
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer pinned bottom — lifts with the on-screen keyboard */}
      <div
        className="flex-shrink-0 px-6 pt-4 space-y-3 bg-background"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 1rem)`,
          transform: kbOffset > 0 ? `translateY(-${kbOffset}px)` : undefined,
          transition: "transform 180ms ease-out",
        }}
      >
        {footer}
        {bottomHint && (
          <p className="text-center text-[13px] text-muted-foreground">{bottomHint}</p>
        )}
      </div>

      <SupportChatBubble />
    </div>
  );

  const ContinueButton: React.FC<{
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    label?: string;
    type?: "button" | "submit";
  }> = ({ onClick, disabled, loading, label = "Continuar", type = "submit" }) => (
    <Button
      type={type}
      onClick={onClick}
      className="w-full h-14 rounded-2xl text-[15px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:shadow-none"
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Aguarde...
        </span>
      ) : (
        label
      )}
    </Button>
  );

  // ── Magic link sent screen ──
  if (step === "magic_sent") {
    return (
      <Shell
        headerTitle="Entrar"
        stepKey="magic"
        title="Verifique seu email"
        subtitle={
          <>
            Enviamos um link de acesso para{" "}
            <strong className="text-foreground">{email}</strong>.
          </>
        }
        footer={
          <Button
            variant="outline"
            className="w-full h-14 rounded-2xl text-[14px]"
            onClick={handleBack}
          >
            Usar outro email
          </Button>
        }
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Mail className="w-6 h-6 text-primary" />
        </div>
      </Shell>
    );
  }

  // ─────────── SIGNUP FLOW ───────────
  if (isSignup) {
    const bottomLogin = (
      <>
        Já tem uma conta?{" "}
        <button
          type="button"
          onClick={() => navigate("/auth?mode=login")}
          className="text-primary font-semibold hover:text-primary/80 transition-colors"
        >
          Entrar
        </button>
      </>
    );

    // Step: PHONE
    if (signupStep === "phone") {
      return (
        <Shell
          headerTitle="Criar conta"
          stepKey="s-phone"
          title="Qual é o seu WhatsApp?"
          subtitle="Enviaremos um código para verificar."
          footer={
            <ContinueButton
              onClick={handleSendOtp}
              type="button"
              disabled={phoneDigits.length < 10}
              loading={signupBusy}
              label="Enviar código"
            />
          }
          bottomHint={bottomLogin}
        >
          <Input
            name="phone"
            type="tel"
            required
            autoFocus
            value={maskPhone(phoneDigits)}
            onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 11))}
            onKeyDown={(e) => { if (e.key === "Enter" && phoneDigits.length >= 10) handleSendOtp(); }}
            className={inputClasses}
            placeholder="(11) 91234-5678"
            autoComplete="tel-national"
            inputMode="numeric"
          />
        </Shell>
      );
    }

    // Step: OTP
    if (signupStep === "otp") {
      return (
        <Shell
          headerTitle="Criar conta"
          stepKey="s-otp"
          title="Digite o código"
          subtitle={<>Enviamos um código de 6 dígitos para <strong className="text-foreground">{maskPhone(phoneDigits)}</strong>.</>}
          footer={
            <ContinueButton
              onClick={handleVerifyOtp}
              type="button"
              disabled={otpCode.length !== 6}
              loading={signupBusy}
              label="Verificar"
            />
          }
          bottomHint={
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={otpCooldown > 0 || signupBusy}
              className="text-primary font-semibold hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              {otpCooldown > 0 ? `Reenviar código em ${otpCooldown}s` : "Reenviar código"}
            </button>
          }
        >
          <Input
            name="otp"
            type="text"
            required
            autoFocus
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter" && otpCode.length === 6) handleVerifyOtp(); }}
            className={`${inputClasses} text-center tracking-[0.5em] text-[20px] font-semibold`}
            placeholder="000000"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
          />
        </Shell>
      );
    }

    // Step: EMAIL
    if (signupStep === "email") {
      const canContinue = emailLooksComplete && !emailExists && !checkingEmail;
      return (
        <Shell
          headerTitle="Criar conta"
          stepKey="s-email"
          title="Qual é o seu email?"
          subtitle="Usaremos para você acessar sua conta."
          footer={
            <ContinueButton
              onClick={() => setSignupStep("password")}
              type="button"
              disabled={!canContinue}
              label="Continuar"
            />
          }
          bottomHint={bottomLogin}
        >
          <div className="relative">
            <Input
              name="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailExists(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" && canContinue) setSignupStep("password"); }}
              className={inputClasses}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
            />
            {checkingEmail && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <AnimatePresence>
            {emailExists && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[12px] text-destructive font-medium mt-2 px-1"
              >
                Este email já possui uma conta.{" "}
                <button
                  type="button"
                  onClick={() => navigate("/auth?mode=login&email=" + encodeURIComponent(email.trim()))}
                  className="underline hover:no-underline"
                >
                  Entrar
                </button>
              </motion.p>
            )}
          </AnimatePresence>
        </Shell>
      );
    }

    // Step: PASSWORD
    return (
      <Shell
        headerTitle="Criar conta"
        stepKey="s-password"
        title="Crie sua senha"
        subtitle="Use pelo menos 6 caracteres."
        footer={
          <ContinueButton
            onClick={() => handleCreateAccount({ preventDefault: () => {} } as React.FormEvent)}
            type="button"
            disabled={senha.length < 6}
            loading={signupBusy}
            label="Criar conta"
          />
        }
      >
        <div className="relative">
          <Input
            name="senha"
            type={showPassword ? "text" : "password"}
            required
            autoFocus
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && senha.length >= 6) {
                handleCreateAccount({ preventDefault: () => {} } as React.FormEvent);
              }
            }}
            className={`${inputClasses} pr-12`}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </Shell>
    );
  }

  // ─────────── LOGIN FLOW ───────────
  const bottomSignup = (
    <>
      Não tem uma conta?{" "}
      <button
        type="button"
        onClick={() => navigate("/escolher-barbearia")}
        className="text-primary font-semibold hover:text-primary/80 transition-colors"
      >
        Criar conta
      </button>
    </>
  );

  // Step: EMAIL
  if (step === "email") {
    return (
      <Shell
        headerTitle="Entrar"
        stepKey="l-email"
        title="Qual é o seu email?"
        subtitle="Use o email cadastrado para acessar sua conta."
        footer={
          <ContinueButton
            onClick={() => setStep("password")}
            type="button"
            disabled={!emailLooksComplete}
            label="Continuar"
          />
        }
        bottomHint={bottomSignup}
      >
        {lastAccount && !email && (
          <button
            type="button"
            onClick={() => {
              setEmail(lastAccount.email);
              setStep("password");
            }}
            className="w-full mb-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3 text-left active:scale-[0.99] transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {lastAccount.avatar_url ? (
                <img src={lastAccount.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[13px] font-semibold text-primary">
                  {(lastAccount.nome || lastAccount.email).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground truncate">
                Entrar como {lastAccount.nome || lastAccount.email.split("@")[0]}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{lastAccount.email}</p>
            </div>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                clearLastAccount();
                setLastAccount(null);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground font-medium px-2 py-1"
            >
              Trocar
            </span>
          </button>
        )}
        <Input
          name="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => { setEmail(e.target.value); setLoginError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && emailLooksComplete) setStep("password"); }}
          className={inputClasses}
          placeholder="seu@email.com"
          autoComplete="email"
          inputMode="email"
        />
      </Shell>
    );
  }

  // Step: PASSWORD
  return (
    <Shell
      headerTitle="Entrar"
      stepKey="l-password"
      title="Digite sua senha"
      subtitle={<>Entrando como <strong className="text-foreground">{email}</strong></>}
      footer={
        <ContinueButton
          onClick={() => handlePasswordSubmit({ preventDefault: () => {} } as React.FormEvent)}
          type="button"
          disabled={senha.length < 1}
          loading={isLoading}
          label="Entrar"
        />
      }
      bottomHint={bottomSignup}
    >
      <div className="relative">
        <Input
          ref={passwordRef}
          name="senha"
          type={showPassword ? "text" : "password"}
          required
          autoFocus
          value={senha}
          onChange={(e) => { setSenha(e.target.value); setLoginError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && senha.length >= 1) {
              handlePasswordSubmit({ preventDefault: () => {} } as React.FormEvent);
            }
          }}
          className={`${inputClasses} pr-12`}
          placeholder="Sua senha"
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      <AnimatePresence>
        {loginError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[12px] text-destructive font-medium mt-2 px-1"
          >
            {loginError}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => navigate("/esqueci-senha")}
          className="text-[13px] text-primary/80 hover:text-primary transition-colors font-medium"
        >
          Esqueci a senha
        </button>
      </div>
    </Shell>
  );
};

export default Auth;
