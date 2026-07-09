import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { formatPhone, validatePhone } from "@/lib/validators";

const CompletarPerfil = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeError, setNomeError] = useState("");
  const [telefoneError, setTelefoneError] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, telefone, barbearia_preferida_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile?.nome && profile?.telefone) {
        navigate(profile.barbearia_preferida_id ? "/cliente" : "/escolher-barbearia", { replace: true });
        return;
      }

      // Pre-fill if partial data exists
      if (profile?.nome) setNome(profile.nome);
      if (profile?.telefone) setTelefone(formatPhone(profile.telefone));

      setIsChecking(false);
    };
    check();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNomeError("");
    setTelefoneError("");

    const trimmedNome = nome.trim();
    if (trimmedNome.length < 2) {
      setNomeError("Nome deve ter pelo menos 2 caracteres");
      return;
    }

    const cleanPhone = telefone.replace(/\D/g, "");
    if (!validatePhone(cleanPhone)) {
      setTelefoneError("WhatsApp inválido");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({ nome: trimmedNome, telefone: cleanPhone })
      .eq("id", userId!);

    if (error) {
      toast.error("Erro ao salvar. Tente novamente.");
      setIsLoading(false);
      return;
    }

    // Registra indicação se houver código pendente (não bloqueia o cadastro se falhar)
    try {
      const pendingRef = sessionStorage.getItem("pending_referral_code");
      if (pendingRef) {
        const sid =
          sessionStorage.getItem("pending_referral_session_id") ||
          localStorage.getItem("dub_ref_session_id");
        await supabase.rpc("registrar_indicacao", {
          p_indicado_id: userId!,
          p_codigo: pendingRef,
          p_session_id: sid,
        });
        sessionStorage.removeItem("pending_referral_code");
        sessionStorage.removeItem("pending_referral_session_id");
      }
    } catch (err) {
      // Silencioso: código inválido ou usuário já indicado — não bloqueia o cadastro
      console.warn("Falha ao registrar indicação:", err);
      sessionStorage.removeItem("pending_referral_code");
      sessionStorage.removeItem("pending_referral_session_id");
    }

    const { data: updated } = await supabase
      .from("profiles")
      .select("barbearia_preferida_id")
      .eq("id", userId!)
      .single();

    navigate(updated?.barbearia_preferida_id ? "/cliente" : "/escolher-barbearia", { replace: true });
  };

  if (isChecking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const inputClasses = "h-12 pl-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <User className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Só mais um passo!
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Como podemos te chamar?
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
              Nome completo
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
              <Input
                type="text"
                required
                value={nome}
                onChange={(e) => { setNome(e.target.value); setNomeError(""); }}
                className={`${inputClasses} capitalize ${nomeError ? "border-destructive/50" : ""}`}
                placeholder="Seu nome"
                maxLength={100}
              />
            </div>
            {nomeError && (
              <p className="text-[11px] text-destructive pl-1">{nomeError}</p>
            )}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
              WhatsApp
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
              <Input
                type="text"
                required
                maxLength={15}
                value={telefone}
                onChange={(e) => { setTelefone(formatPhone(e.target.value)); setTelefoneError(""); }}
                className={`${inputClasses} ${telefoneError ? "border-destructive/50" : ""}`}
                placeholder="(00) 00000-0000"
              />
            </div>
            {telefoneError && (
              <p className="text-[11px] text-destructive pl-1">{telefoneError}</p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-[50px] mt-2 rounded-xl text-[14px] font-semibold transition-all duration-200"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow-red)" }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              "Continuar"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Suas informações são usadas apenas para identificação nos agendamentos
        </p>
      </motion.div>
    </div>
  );
};

export default CompletarPerfil;
