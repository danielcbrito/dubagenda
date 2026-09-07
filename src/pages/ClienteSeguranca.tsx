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
      className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-neutral-50/80 active:bg-neutral-100/70 transition-colors border-b border-neutral-100 last:border-b-0"
    >
      <div className="w-10 h-10 rounded-[14px] bg-neutral-100 flex items-center justify-center flex-shrink-0">
        <Icon className="h-[18px] w-[18px] text-neutral-500" strokeWidth={1.75} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[14px] font-medium text-neutral-900 tracking-tight">{title}</p>
        <p className="text-[12px] text-neutral-400 truncate mt-0.5 font-normal">{subtitle}</p>
      </div>
      {trailing || <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0" />}
    </button>
  );
}

/* ─── Password / PIN Input Field ─── */
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
    <div className="space-y-2">
      <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-widest">{label}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            "w-full h-12 px-4 pr-11 bg-neutral-50 border rounded-[14px] text-[14px] text-neutral-900 placeholder:text-neutral-300 font-medium",
            "focus:outline-none focus:border-neutral-300 focus:bg-white transition-all duration-200",
            error ? "border-red-200 focus:border-red-400" : "border-neutral-200"
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-[11px] font-medium text-red-500 pl-1">{error}</p>}
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
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
      setNewPassword(""); setConfirmPassword("");
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
    } else {
      navigate("/cliente/perfil");
    }
  };

  const viewTitle = view === "change-password"
    ? "Alterar Senha"
    : view === "wallet-pin"
    ? "PIN da Carteira"
    : "Segurança";

  return (
    <div className="flex flex-col h-dvh bg-[#FAFAF9] overflow-hidden">

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-[15%] -right-[10%] w-[350px] h-[350px] rounded-full bg-[#F0EDE8]/60 blur-[120px]" />
        <div className="absolute bottom-[10%] -left-[10%] w-[300px] h-[300px] rounded-full bg-[#E8ECF0]/50 blur-[110px]" />
      </div>

      {/* ── Header ── */}
      <div className="flex-shrink-0 relative z-10 px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-4">
        <div className="flex items-center gap-3">
          <BackArrow onClick={goBack} />
          <AnimatePresence mode="wait">
            <motion.h1
              key={viewTitle}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="text-[17px] font-semibold text-neutral-900 tracking-tight"
            >
              {viewTitle}
            </motion.h1>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] relative z-10">
        <AnimatePresence mode="wait">

          {/* ─── Menu ─── */}
          {view === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="space-y-4 pt-1"
            >
              {/* Status card */}
              <div className="flex items-center gap-3.5 px-4 py-4 rounded-[22px] bg-white border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div className="w-10 h-10 rounded-[14px] bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-neutral-900 tracking-tight">Conta protegida</p>
                  <p className="text-[12px] text-neutral-400 mt-0.5">Gerencie suas credenciais abaixo</p>
                </div>
              </div>

              {/* Menu items */}
              <div className="rounded-[22px] border border-neutral-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
                <SecurityItem
                  icon={KeyRound}
                  title="Alterar Senha"
                  subtitle="Trocar a senha de acesso à conta"
                  onClick={() => setView("change-password")}
                />
                <SecurityItem
                  icon={Wallet}
                  title="PIN da Carteira"
                  subtitle={
                    loadingStatus
                      ? "Carregando..."
                      : hasWalletPin
                      ? "PIN ativo — toque para gerenciar"
                      : "Proteja sua carteira com um PIN"
                  }
                  onClick={() => setView("wallet-pin")}
                  trailing={
                    hasWalletPin ? (
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg font-semibold">
                        <Lock className="h-3 w-3" /> Ativo
                      </span>
                    ) : undefined
                  }
                />
              </div>
            </motion.div>
          )}

          {/* ─── Change Password ─── */}
          {view === "change-password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="space-y-4 pt-1"
            >
              <div className="rounded-[22px] border border-neutral-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 space-y-4">
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
                className="w-full h-[50px] rounded-[14px] bg-neutral-900 text-white text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
              >
                {savingPassword
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Check className="w-4 h-4" /> Salvar Nova Senha</>}
              </button>
            </motion.div>
          )}

          {/* ─── Wallet PIN ─── */}
          {view === "wallet-pin" && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="space-y-4 pt-1"
            >
              <div className="rounded-[22px] border border-neutral-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 space-y-4">
                {hasWalletPin && (
                  <PinField
                    label="PIN Atual"
                    value={currentPin}
                    onChange={(v) => setCurrentPin(v.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Seu PIN de 4 a 6 dígitos"
                    maxLength={6}
                    isPassword
                  />
                )}
                <div className={hasWalletPin ? "pt-1" : ""}>
                  <PinField
                    label={hasWalletPin ? "Novo PIN" : "Criar PIN"}
                    value={newPin}
                    onChange={(v) => setNewPin(v.replace(/\D/g, "").slice(0, 6))}
                    placeholder="4 a 6 dígitos numéricos"
                    maxLength={6}
                    isPassword
                  />
                </div>
                <PinField
                  label="Confirmar Novo PIN"
                  value={confirmPin}
                  onChange={(v) => setConfirmPin(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Repita o novo PIN"
                  maxLength={6}
                  isPassword
                  error={confirmPin && newPin !== confirmPin ? "Os PINs não conferem" : ""}
                />
              </div>

              <button
                onClick={handleSaveWalletPin}
                disabled={savingPin || !newPin || newPin !== confirmPin || (hasWalletPin && !currentPin)}
                className="w-full h-[50px] rounded-[14px] bg-neutral-900 text-white text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
              >
                {savingPin
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Check className="w-4 h-4" /> Salvar PIN da Carteira</>}
              </button>

              {hasWalletPin && (
                <button
                  onClick={handleRemoveWalletPin}
                  disabled={savingPin || !currentPin}
                  className="w-full h-[46px] rounded-[14px] bg-white border border-red-100 text-red-500 text-[13px] font-medium flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-red-50/50 active:scale-[0.98] transition-all"
                >
                  <X className="w-4 h-4" />
                  Remover PIN
                </button>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
