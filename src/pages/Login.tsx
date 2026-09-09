import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff, Mail, Phone, ArrowRight } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { saveLastAccount } from "@/utils/lastAccount";
import { getVerifiedAuthUser } from "@/utils/authSession";
import logoDub from "@/assets/logo-dub.png";

/**
 * Login mobile-first estilo "Mr Caseiro":
 * - h-[100dvh] com safe-area, sem gradientes genéricos
 * - Paleta quente escura (preto/marrom/dourado)
 * - Toggle Email ⇄ Telefone
 * - Convidado + Esqueci minha senha
 * - Anti-zoom iOS, touch targets 48px, scrollIntoView no foco
 */

type Method = "email" | "phone";

const emailSchema = z.string().trim().email("Email inválido").max(255);

const maskPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/cliente";

  const { height, keyboardOpen } = useViewportHeight();

  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState(params.get("email") || "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  // Se já autenticado, redireciona
  useEffect(() => {
    getVerifiedAuthUser().then((user) => {
      if (user?.email_confirmed_at) navigate(redirect, { replace: true });
    });
  }, [navigate, redirect]);

  const canSubmit =
    password.length >= 1 &&
    (method === "email" ? email.trim().length > 4 : phone.replace(/\D/g, "").length >= 10);

  const focusScroll = (el: HTMLElement | null) => {
    if (!el) return;
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
  };

  const resolveEmail = async (): Promise<string> => {
    if (method === "email") return emailSchema.parse(email);
    // Busca email pelo WhatsApp via edge function existente
    const digits = phone.replace(/\D/g, "");
    const { data, error } = await supabase.functions.invoke("find-email-by-whatsapp", {
      body: { whatsapp: digits },
    });
    if (error || !data?.email) throw new Error("Não encontramos conta com esse telefone.");
    return data.email as string;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const resolvedEmail = await resolveEmail();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });
      if (error) {
        const isEmailUnconfirmed = error.message.includes("Email not confirmed");
        const msg = isEmailUnconfirmed
          ? "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou tente recuperar a senha."
          : error.message.includes("Invalid login")
            ? "Credenciais incorretas"
            : "Erro ao entrar. Tente novamente.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      if (data.user) {
        supabase
          .from("profiles")
          .select("nome, avatar_url")
          .eq("id", data.user.id)
          .maybeSingle()
          .then(({ data: p }) => {
            saveLastAccount({
              nome: p?.nome ?? null,
              email: data.user.email ?? resolvedEmail,
              avatar_url: p?.avatar_url ?? null,
            });
          }, () => {});
        toast.success("Bem-vindo de volta");
        navigate(redirect, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || "Não foi possível entrar";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Paleta local — preto profundo + dourado quente. Independente do tema global.
  const BG = "#0B0906"; // preto quente
  const CARD = "#141010";
  const BORDER = "#2A211B";
  const GOLD = "#D4A24C";
  const TEXT = "#F5EEE3";
  const MUTED = "#9C8B7A";

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col overflow-hidden"
      style={{
        height,
        background: BG,
        color: TEXT,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Ornamento sutil dourado no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-60"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(212,162,76,0.18) 0%, rgba(212,162,76,0) 70%)",
        }}
      />

      {/* Topo: logo */}
      <div className="flex-shrink-0 px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={logoDub} alt="DUB Agenda" className="h-9 w-9 rounded-xl object-cover shadow-md" />
          <span className="text-[17px] font-bold tracking-tight text-white">DUB Agenda</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-[13px] font-medium"
          style={{ color: MUTED, touchAction: "manipulation" }}
        >
          Entrar como convidado
        </button>
      </div>

      {/* Conteúdo */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6"
        style={{ paddingTop: keyboardOpen ? 16 : 40 }}
      >
        <div className="max-w-md mx-auto">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: MUTED }}>
            Entre com seu e-mail ou telefone para continuar
          </p>

          {/* Toggle Email / Telefone */}
          <div
            className="mt-6 grid grid-cols-2 p-1 rounded-xl"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            {(["email", "phone"] as Method[]).map((m) => {
              const active = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className="h-10 rounded-lg text-[13.5px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  style={{
                    background: active ? GOLD : "transparent",
                    color: active ? "#1A1206" : MUTED,
                    touchAction: "manipulation",
                  }}
                >
                  {m === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  {m === "email" ? "E-mail" : "Telefone"}
                </button>
              );
            })}
          </div>

          {/* Formulário */}
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            {method === "email" ? (
              <div>
                <label className="block text-[12px] mb-1.5 font-medium" style={{ color: MUTED }}>
                  E-mail
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => focusScroll(e.currentTarget)}
                  className="w-full min-h-[48px] rounded-xl px-4 outline-none"
                  style={{
                    background: CARD,
                    color: TEXT,
                    border: `1px solid ${BORDER}`,
                    fontSize: 16, // evita zoom iOS
                    WebkitTapHighlightColor: "transparent",
                  }}
                  onFocusCapture={(e) => (e.currentTarget.style.borderColor = GOLD)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
                />
              </div>
            ) : (
              <div>
                <label className="block text-[12px] mb-1.5 font-medium" style={{ color: MUTED }}>
                  Telefone
                </label>
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  value={maskPhone(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={(e) => focusScroll(e.currentTarget)}
                  className="w-full min-h-[48px] rounded-xl px-4 outline-none"
                  style={{
                    background: CARD,
                    color: TEXT,
                    border: `1px solid ${BORDER}`,
                    fontSize: 16,
                    WebkitTapHighlightColor: "transparent",
                  }}
                  onFocusCapture={(e) => (e.currentTarget.style.borderColor = GOLD)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-medium" style={{ color: MUTED }}>
                  Senha
                </label>
                <Link
                  to="/esqueci-senha"
                  className="text-[12px] font-medium"
                  style={{ color: GOLD }}
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <input
                  ref={passRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={(e) => focusScroll(e.currentTarget)}
                  className="w-full min-h-[48px] rounded-xl px-4 pr-12 outline-none"
                  style={{
                    background: CARD,
                    color: TEXT,
                    border: `1px solid ${BORDER}`,
                    fontSize: 16,
                    WebkitTapHighlightColor: "transparent",
                  }}
                  onFocusCapture={(e) => (e.currentTarget.style.borderColor = GOLD)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg"
                  style={{ color: MUTED, touchAction: "manipulation" }}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <p className="text-[12.5px]" style={{ color: "#E86A6A" }}>
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full min-h-[48px] rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{
                background: canSubmit && !loading ? GOLD : "#3A2F24",
                color: canSubmit && !loading ? "#1A1206" : MUTED,
                opacity: !canSubmit || loading ? 0.75 : 1,
                cursor: !canSubmit || loading ? "not-allowed" : "pointer",
                touchAction: "manipulation",
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: BORDER }} />
            <span className="text-[11px] uppercase tracking-widest" style={{ color: MUTED }}>
              ou
            </span>
            <div className="flex-1 h-px" style={{ background: BORDER }} />
          </div>

          <button
            type="button"
            onClick={() => navigate("/auth?mode=signup")}
            className="w-full min-h-[48px] rounded-xl font-semibold text-[14.5px] active:scale-[0.98] transition-transform"
            style={{
              background: "transparent",
              color: TEXT,
              border: `1px solid ${BORDER}`,
              touchAction: "manipulation",
            }}
          >
            Criar nova conta
          </button>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed" style={{ color: MUTED }}>
            Ao continuar, você concorda com os{" "}
            <span style={{ color: TEXT }}>Termos</span> e{" "}
            <span style={{ color: TEXT }}>Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
