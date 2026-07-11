import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useViewportHeight } from "@/hooks/useViewportHeight";
import logoDub from "@/assets/logo-dub.png";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(1, "Senha é obrigatória");

type AuthStep = "email" | "password" | "magic_sent";

// ─────────── Shared "One-Question" shell (module-scope, stable identity) ───────────
interface AuthShellProps {
  headerTitle: string;
  title: string;
  subtitle?: React.ReactNode;
  stepKey: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  bottomHint?: React.ReactNode;
  onBack: () => void;
}

const AuthShell: React.FC<AuthShellProps> = ({
  headerTitle, title, subtitle, stepKey, children, footer, bottomHint, onBack,
}) => {
  // Estratégia "Mr Caseiro": fluxo natural do documento com min-h-dvh.
  // O navegador (Android/iOS) reduz automaticamente o viewport quando o teclado abre
  // e faz scroll do input focado — o botão "Continuar" sobe suavemente logo acima
  // do teclado sem sobrepor os campos.
  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-background"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Header transparente — sem barra, apenas seta + título */}
      <div className="relative flex-shrink-0 flex items-center justify-center px-4 h-14">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-3 p-2 -m-2 text-foreground hover:text-foreground/70 transition-colors"
          aria-label="Voltar"
        >
          <BackArrow size={20} />
        </button>
        <h2 className="text-[15px] font-semibold text-foreground">{headerTitle}</h2>
      </div>

      {/* Conteúdo — cresce naturalmente, empurra o footer para baixo */}
      <div className="flex-1 flex flex-col px-6 pt-2">
        <img
          src={logoDub}
          alt="DUB"
          className="w-14 h-14 object-contain mb-8 [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)]"
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

      {/* Footer em fluxo natural — sem fixed/sticky, sem bg extra */}
      <div
        className="flex-shrink-0 px-6 pt-6 space-y-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {footer}
        {bottomHint && (
          <p className="text-center text-[13px] text-muted-foreground">{bottomHint}</p>
        )}
      </div>

      <SupportChatBubble />
    </div>
  );
};

interface ContinueButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  type?: "button" | "submit";
}

const ContinueButtonBase: React.FC<ContinueButtonProps> = ({
  onClick, disabled, loading, label = "Continuar", type = "submit",
}) => (
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

const Auth = () => {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const signupOrigin = searchParams.get("origin") || "dub_exclusive";
  const isSignup = mode === "signup";

  const prefilledEmailParam = searchParams.get("email");
  const [step, setStep] = useState<AuthStep>(
    !isSignup && prefilledEmailParam ? "password" : "email"
  );
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

  // ── Signup multi-step: Nome → CPF → Email → WhatsApp → OTP → Senha ──
  type SignupStep = "nome" | "cpf" | "email" | "phone" | "otp" | "password";
  const [signupStep, setSignupStep] = useState<SignupStep>("nome");
  const [nome, setNome] = useState("");
  const [cpfDigits, setCpfDigits] = useState(""); // 11 digits, no mask
  const [phoneDigits, setPhoneDigits] = useState(""); // BR digits (10 or 11, no country code)
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [signupBusy, setSignupBusy] = useState(false);
  const [cpfTaken, setCpfTaken] = useState(false);
  const [checkingCpf, setCheckingCpf] = useState(false);
  const cpfDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // Debounced CPF duplicate check
  useEffect(() => {
    if (cpfDebounceRef.current) clearTimeout(cpfDebounceRef.current);
    setCpfTaken(false);
    if (cpfDigits.length !== 11) { setCheckingCpf(false); return; }
    setCheckingCpf(true);
    cpfDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("check-duplicate-signup", {
          body: { cpf: cpfDigits },
        });
        setCpfTaken(Array.isArray(data?.duplicates) && data.duplicates.includes("cpf"));
      } catch {
        setCpfTaken(false);
      } finally {
        setCheckingCpf(false);
      }
    }, 400);
    return () => { if (cpfDebounceRef.current) clearTimeout(cpfDebounceRef.current); };
  }, [cpfDigits]);

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

  const maskCpf = (digits: string) => {
    const d = digits.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };

  // Full CPF validation with checksum digits
  const isValidCpf = (digits: string) => {
    const d = digits.replace(/\D/g, "");
    if (d.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(d)) return false;
    const calc = (base: number) => {
      let sum = 0;
      for (let i = 0; i < base; i++) sum += parseInt(d[i]) * (base + 1 - i);
      const r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
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
      setSignupStep("password");
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
            nome: nome.trim() || validEmail.split("@")[0],
            cpf: cpfDigits.replace(/\D/g, ""),
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

      // Best-effort: garantir nome + CPF persistidos no profile (idempotente).
      try {
        await supabase
          .from("profiles")
          .update({
            nome: nome.trim() || validEmail.split("@")[0],
            cpf: cpfDigits.replace(/\D/g, "") || null,
          })
          .eq("id", userId);
      } catch {
        /* ignore — perfil será completado depois se falhar */
      }

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

  // Back handler with per-step logic
  const handleBack = () => {
    if (step === "magic_sent") {
      setStep("email");
      setSenha("");
      setLoginError(null);
      return;
    }
    if (isSignup) {
      if (signupStep === "password") return setSignupStep("otp");
      if (signupStep === "otp") return setSignupStep("phone");
      if (signupStep === "phone") return setSignupStep("email");
      if (signupStep === "email") return setSignupStep("cpf");
      if (signupStep === "cpf") return setSignupStep("nome");
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

  // Stable Shell/ContinueButton references — prevent full remount (and
  // input focus loss / keyboard flicker) on every keystroke.
  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;
  const stableOnBack = useCallback(() => handleBackRef.current(), []);
  const Shell = useMemo(() => {
    const C: React.FC<{
      headerTitle: string;
      title: string;
      subtitle?: React.ReactNode;
      stepKey: string;
      children: React.ReactNode;
      footer: React.ReactNode;
      bottomHint?: React.ReactNode;
    }> = (props) => (
      <AuthShell {...props} onBack={stableOnBack} />
    );
    return C;
  }, [stableOnBack]);


  const ContinueButton = ContinueButtonBase;



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

    // Step: NOME
    if (signupStep === "nome") {
      const canContinue = nome.trim().length >= 2;
      return (
        <Shell
          headerTitle="Criar conta"
          stepKey="s-nome"
          title="Qual é o seu nome?"
          subtitle="Como você quer ser chamado."
          footer={
            <ContinueButton
              onClick={() => setSignupStep("cpf")}
              type="button"
              disabled={!canContinue}
              label="Continuar"
            />
          }
          bottomHint={bottomLogin}
        >
          <Input
            name="nome"
            type="text"
            required
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canContinue) setSignupStep("cpf"); }}
            className={inputClasses}
            placeholder="Seu nome completo"
            autoComplete="name"
            maxLength={80}
          />
        </Shell>
      );
    }

    // Step: CPF
    if (signupStep === "cpf") {
      const cpfValid = isValidCpf(cpfDigits);
      const canContinue = cpfValid && !cpfTaken && !checkingCpf;
      const goToLogin = () => {
        setSignupStep("nome");
        navigate("/auth?mode=login", { replace: true });
      };
      return (
        <Shell
          headerTitle="Criar conta"
          stepKey="s-cpf"
          title="Qual é o seu CPF?"
          subtitle="Usado somente para identificar sua conta."
          footer={
            <ContinueButton
              onClick={() => setSignupStep("email")}
              type="button"
              disabled={!canContinue}
              label="Continuar"
            />
          }
          bottomHint={bottomLogin}
        >
          <Input
            name="cpf"
            type="text"
            required
            autoFocus
            value={maskCpf(cpfDigits)}
            onChange={(e) => setCpfDigits(e.target.value.replace(/\D/g, "").slice(0, 11))}
            onKeyDown={(e) => { if (e.key === "Enter" && canContinue) setSignupStep("email"); }}
            className={inputClasses}
            placeholder="000.000.000-00"
            autoComplete="off"
            inputMode="numeric"
          />
          {cpfDigits.length === 11 && !cpfValid && (
            <p className="text-[12px] text-destructive font-medium mt-2 px-1">
              CPF inválido. Verifique os dígitos.
            </p>
          )}
          {cpfValid && cpfTaken && (
            <p className="text-[13px] text-destructive font-medium mt-2 px-1">
              CPF já cadastrado. Faça login para continuar.{" "}
              <button
                type="button"
                onClick={goToLogin}
                className="underline underline-offset-2 font-semibold"
              >
                Entrar agora
              </button>
            </p>
          )}
        </Shell>
      );
    }


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
              onClick={() => setSignupStep("phone")}
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
              onKeyDown={(e) => { if (e.key === "Enter" && canContinue) setSignupStep("phone"); }}
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
