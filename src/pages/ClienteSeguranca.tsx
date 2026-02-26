import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BackArrow } from "@/components/ui/back-arrow";
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Wallet,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Section Item ─── */
interface SecurityItemProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}
function SecurityItem({ icon: Icon, title, subtitle, onClick, trailing }: SecurityItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 active:bg-secondary/70 transition-colors border-b border-border/20 last:border-b-0"
    >
      <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">{subtitle}</p>
      </div>
      {trailing || <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
    </button>
  );
}

/* ─── Password Input Field ─── */
interface PinFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  isPassword?: boolean;
  error?: string;
}
function PinField({ label, value, onChange, placeholder, maxLength, isPassword = false, error }: PinFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.1em] font-medium">{label}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            "w-full h-9 px-3 pr-10 bg-muted/30 border rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground/40",
            "focus:outline-none focus:border-border/50 focus:ring-0 transition-colors",
            error ? "border-destructive/60" : "border-border/30"
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {error && <p className="text-[9px] text-destructive">{error}</p>}
    </div>
  );
}

/* ─── Views ─── */
type ViewType = "menu" | "change-password" | "wallet-pin";

export default function ClienteSeguranca() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewType>("menu");
  const [hasWalletPin, setHasWalletPin] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Wallet PIN
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    checkWalletPinStatus();
  }, []);

  const checkWalletPinStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("wallet-pin", {
        body: { action: "status" },
      });
      if (!error && data) setHasWalletPin(data.has_pin);
    } catch {
      // ignore
    }
    setLoadingStatus(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }

    setSavingPassword(true);
    try {
      // Supabase updateUser changes the password for the logged-in user
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setView("menu");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveWalletPin = async () => {
    if (!newPin || newPin.length < 4 || newPin.length > 6) {
      toast.error("O PIN deve ter entre 4 e 6 dígitos");
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      toast.error("O PIN deve conter apenas números");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Os PINs não conferem");
      return;
    }

    setSavingPin(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-pin", {
        body: {
          action: hasWalletPin ? "update" : "set",
          pin: newPin,
          current_pin: hasWalletPin ? currentPin : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); setSavingPin(false); return; }

      toast.success(hasWalletPin ? "PIN atualizado!" : "PIN da carteira definido!");
      setHasWalletPin(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setView("menu");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar PIN");
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemoveWalletPin = async () => {
    if (!currentPin) {
      toast.error("Digite o PIN atual para remover");
      return;
    }

    setSavingPin(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-pin", {
        body: { action: "remove", current_pin: currentPin },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); setSavingPin(false); return; }

      toast.success("PIN removido com sucesso!");
      setHasWalletPin(false);
      setCurrentPin("");
      setView("menu");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover PIN");
    } finally {
      setSavingPin(false);
    }
  };

  const goBack = () => {
    if (view !== "menu") {
      setView("menu");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
    } else {
      navigate("/cliente/perfil");
    }
  };

  const viewTitle = view === "change-password" ? "Alterar Senha" : view === "wallet-pin" ? "PIN da Carteira" : "Segurança";

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={goBack}
          className="h-7 w-7 rounded-md bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors"
        >
          <BackArrow size={16} className="text-foreground" />
        </button>
        <h1 className="text-[14px] font-semibold tracking-tight text-foreground">{viewTitle}</h1>
      </div>

      <AnimatePresence mode="wait">
        {/* ─── Menu ─── */}
        {view === "menu" && (
          <motion.div key="menu" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="px-4 space-y-4">
            {/* Status card */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border/30 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-[12px] font-medium text-foreground">Sua conta está protegida</p>
                <p className="text-[10px] text-muted-foreground/60">Gerencie suas credenciais abaixo</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/30 bg-card shadow-sm overflow-hidden">
              <SecurityItem
                icon={KeyRound}
                title="Alterar Senha"
                subtitle="Trocar a senha de acesso à conta"
                onClick={() => setView("change-password")}
              />
              <SecurityItem
                icon={Wallet}
                title="PIN da Carteira"
                subtitle={loadingStatus ? "Carregando..." : hasWalletPin ? "PIN ativo — toque para gerenciar" : "Proteja sua carteira com um PIN"}
                onClick={() => setView("wallet-pin")}
                trailing={
                  hasWalletPin ? (
                    <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded font-semibold">
                      <Lock className="h-2.5 w-2.5" /> Ativo
                    </span>
                  ) : undefined
                }
              />
            </div>
          </motion.div>
        )}

        {/* ─── Change Password ─── */}
        {view === "change-password" && (
          <motion.div key="password" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="px-4 space-y-4">
            <div className="rounded-xl border border-border/30 bg-card shadow-sm p-4 space-y-3">
              <PinField
                label="Nova Senha"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Mínimo 6 caracteres"
                isPassword
              />
              <PinField
                label="Confirmar Nova Senha"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repita a nova senha"
                isPassword
                error={confirmPassword && newPassword !== confirmPassword ? "As senhas não conferem" : ""}
              />
            </div>

            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
              className={cn(
                "w-full h-10 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all",
                "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {savingPassword ? "Salvando..." : "Alterar Senha"}
            </button>
          </motion.div>
        )}

        {/* ─── Wallet PIN ─── */}
        {view === "wallet-pin" && (
          <motion.div key="wallet-pin" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="px-4 space-y-4">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border/30 shadow-sm">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                {hasWalletPin
                  ? "Sua carteira está protegida com um PIN. Você pode alterá-lo ou removê-lo."
                  : "Defina um PIN de 4 a 6 dígitos para proteger o acesso à sua carteira."}
              </p>
            </div>

            <div className="rounded-xl border border-border/30 bg-card shadow-sm p-4 space-y-3">
              {hasWalletPin && (
                <PinField
                  label="PIN Atual"
                  value={currentPin}
                  onChange={(v) => setCurrentPin(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Digite o PIN atual"
                  isPassword
                  maxLength={6}
                />
              )}
              <PinField
                label={hasWalletPin ? "Novo PIN" : "Definir PIN"}
                value={newPin}
                onChange={(v) => setNewPin(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="4 a 6 dígitos"
                isPassword
                maxLength={6}
              />
              <PinField
                label="Confirmar PIN"
                value={confirmPin}
                onChange={(v) => setConfirmPin(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="Repita o PIN"
                isPassword
                maxLength={6}
                error={confirmPin && newPin !== confirmPin ? "Os PINs não conferem" : ""}
              />
            </div>

            <button
              onClick={handleSaveWalletPin}
              disabled={savingPin || !newPin || newPin !== confirmPin}
              className={cn(
                "w-full h-10 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all",
                "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {savingPin ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {savingPin ? "Salvando..." : hasWalletPin ? "Atualizar PIN" : "Definir PIN"}
            </button>

            {hasWalletPin && (
              <button
                onClick={handleRemoveWalletPin}
                disabled={savingPin || !currentPin}
                className="w-full h-10 rounded-xl text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Remover PIN
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
