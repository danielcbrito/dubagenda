import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, Phone, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
import { motion, AnimatePresence } from "framer-motion";

type Step = "phone" | "otp" | "new_password" | "success";

const getEdgeFunctionErrorMessage = async (error: unknown, fallback: string) => {
  const candidate = error as { context?: Response; message?: string } | null;

  if (candidate?.context) {
    try {
      const payload = await candidate.context.clone().json();
      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
      ) {
        return payload.error;
      }
    } catch {
      // Se não for JSON, tenta pegar o texto puro
      try {
        const text = await candidate.context.clone().text();
        if (text && text.length < 200) return text;
      } catch {
        // Ignora erros de leitura
      }
    }
  }

  if (candidate?.message) return candidate.message;
  return fallback;
};

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const maskPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe um WhatsApp válido");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-verification", {
        body: { action: "reset_password_send", phone: digits },
      });
      if (error) {
        toast.error(await getEdgeFunctionErrorMessage(error, "Erro ao enviar código"));
        return;
      }
      if (!data?.success) {
        toast.error(data?.error || "Erro ao enviar código");
        return;
      }
      toast.success("Código enviado para seu WhatsApp");
      setStep("otp");
    } catch (err) {
      toast.error(await getEdgeFunctionErrorMessage(err, "Erro ao processar solicitação"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("O código deve ter 6 dígitos");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-verification", {
        body: { 
          action: "reset_password_verify", 
          phone: phone.replace(/\D/g, ""),
          code: otp 
        },
      });
      if (error) {
        toast.error(await getEdgeFunctionErrorMessage(error, "Código inválido"));
        return;
      }
      if (!data?.success) {
        toast.error(data?.error || "Código inválido");
        return;
      }
      setToken(data.verification_token);
      setStep("new_password");
    } catch (err) {
      toast.error(await getEdgeFunctionErrorMessage(err, "Erro ao validar código"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-verification", {
        body: { 
          action: "reset_password_execute", 
          phone: phone.replace(/\D/g, ""),
          verification_token: token,
          new_password: newPassword
        },
      });
      if (error) {
        toast.error(await getEdgeFunctionErrorMessage(error, "Erro ao redefinir senha"));
        return;
      }
      if (!data?.success) {
        toast.error(data?.error || "Erro ao redefinir senha");
        return;
      }
      setStep("success");
      toast.success("Senha alterada com sucesso!");
      setTimeout(() => navigate("/auth"), 3000);
    } catch (err) {
      toast.error(await getEdgeFunctionErrorMessage(err, "Erro ao atualizar senha"));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm";

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute top-0 left-0 pt-[calc(env(safe-area-inset-top)+1rem)] pl-6 z-10"
      >
        <button
          onClick={() => step === "phone" ? navigate("/auth") : setStep(step === "otp" ? "phone" : "otp")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackArrow size={18} />
          <span className="text-[13px]">Voltar</span>
        </button>
      </motion.div>

      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="w-full max-w-sm mx-auto flex flex-col items-center">
          <motion.img
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            src={logoDub}
            alt="DUB"
            className="w-14 h-14 rounded-2xl object-cover shadow-md mb-6"
          />

          <AnimatePresence mode="wait">
            {step === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full text-center"
              >
                <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1.5">Recuperar senha</h1>
                <p className="text-[13px] text-muted-foreground mb-6">Digite seu WhatsApp para receber o código</p>
                <form onSubmit={handleSendOtp} className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                      <Input
                        type="tel"
                        required
                        autoFocus
                        value={phone}
                        onChange={(e) => setPhone(maskPhone(e.target.value))}
                        className={inputClasses + " pl-11"}
                        placeholder="(00) 00000-0000"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl text-[14px] font-semibold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar código de recuperação"}
                  </Button>
                </form>
              </motion.div>
            )}

            {step === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full text-center"
              >
                <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1.5">Validar código</h1>
                <p className="text-[13px] text-muted-foreground mb-6">Digite o código de 6 dígitos que enviamos para {phone}</p>
                <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">Código</label>
                    <Input
                      type="text"
                      required
                      autoFocus
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className={inputClasses + " text-center text-lg tracking-[0.5em] font-bold"}
                      placeholder="000000"
                      inputMode="numeric"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl text-[14px] font-semibold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Validar código"}
                  </Button>
                </form>
              </motion.div>
            )}

            {step === "new_password" && (
              <motion.div
                key="new-pwd"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full text-center"
              >
                <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1.5">Nova senha</h1>
                <p className="text-[13px] text-muted-foreground mb-6">Crie uma nova senha para sua conta</p>
                <form onSubmit={handleResetPassword} className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        required
                        autoFocus
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClasses + " px-11"}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">Confirmar Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                      <Input
                        type={showConfirm ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClasses + " px-11"}
                        placeholder="Repita a senha"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl text-[14px] font-semibold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Alterar senha"}
                  </Button>
                </form>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Senha alterada!</h1>
                <p className="text-[13px] text-muted-foreground mb-6">Sua senha foi atualizada com sucesso. Você será redirecionado para o login.</p>
                <Button onClick={() => navigate("/auth")} className="w-full h-12 rounded-xl">Ir para Login</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;