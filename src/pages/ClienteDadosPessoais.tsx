import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BackArrow } from "@/components/ui/back-arrow";
import {
  User,
  MapPin,
  Phone,
  ChevronRight,
  Save,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateCPF, formatCPF, formatPhone, validatePhone } from "@/lib/validators";

/* ─── Compact Field ─── */
interface CompactFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  error?: string;
  type?: string;
  className?: string;
  disabled?: boolean;
}
function CompactField({ label, value, onChange, placeholder, required, maxLength, error, type = "text", className, disabled }: CompactFieldProps) {
  const isEmpty = required && !value.trim();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider">
        {label}{required && " *"}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className={cn(
          "w-full h-11 px-4 bg-neutral-50 border rounded-xl text-[14px] text-[#18181B] placeholder:text-neutral-400 font-medium",
          "focus:outline-none focus:border-neutral-300 focus:bg-white transition-colors",
          isEmpty && !error ? "border-red-500/50" : "border-neutral-200",
          error ? "border-red-500/50 focus:border-red-500" : "",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Accordion Section ─── */
interface AccordionSectionProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  missingCount?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}
function AccordionSection({ icon: Icon, title, subtitle, missingCount, children, defaultOpen = false }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-neutral-50 active:bg-neutral-100 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-neutral-500" strokeWidth={2} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[14px] font-medium text-[#18181B]">{title}</p>
          {subtitle && <p className="text-[12px] text-neutral-500 truncate mt-0.5">{subtitle}</p>}
        </div>
        {(missingCount ?? 0) > 0 && (
          <span className="rounded-md bg-red-50 text-red-600 text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center px-1.5">
            {missingCount}
          </span>
        )}
        <ChevronRight
          className={cn(
            "h-4 w-4 text-neutral-300 transition-transform duration-200",
            open && "rotate-90"
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-1 space-y-4 border-t border-neutral-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main Page ─── */

interface FormData {
  nome: string;
  cpf: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  cep: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
}

const EMPTY_FORM: FormData = {
  nome: "", cpf: "", data_nascimento: "", email: "", telefone: "",
  cep: "", endereco_rua: "", endereco_numero: "", endereco_bairro: "",
  endereco_cidade: "", endereco_uf: "",
};

export default function ClienteDadosPessoais() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [original, setOriginal] = useState<FormData>(EMPTY_FORM);
  const [userId, setUserId] = useState<string>("");
  const [cpfError, setCpfError] = useState("");
  const [telefoneError, setTelefoneError] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    setUserId(user.id);

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();

    const data: FormData = {
      nome: prof?.nome || "",
      cpf: formatCPF(prof?.cpf || ""),
      data_nascimento: (prof as any)?.data_nascimento || "",
      email: user.email || "",
      telefone: formatPhone(prof?.telefone || ""),
      cep: prof?.cep || "",
      endereco_rua: (prof as any)?.endereco_rua || "",
      endereco_numero: (prof as any)?.endereco_numero || "",
      endereco_bairro: (prof as any)?.endereco_bairro || "",
      endereco_cidade: (prof as any)?.endereco_cidade || "",
      endereco_uf: (prof as any)?.endereco_uf || "",
    };
    setForm(data);
    setOriginal(data);
    setLoading(false);
  };

  const hasChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);

  const set = (field: keyof FormData, value: string) => {
    let v = value;
    if (field === "cpf") {
      v = formatCPF(value);
      const clean = value.replace(/\D/g, "");
      setCpfError(clean.length === 11 && !validateCPF(clean) ? "CPF inválido" : "");
    } else if (field === "telefone") {
      v = formatPhone(value);
      const clean = value.replace(/\D/g, "");
      setTelefoneError(clean.length >= 10 && !validatePhone(clean) ? "Telefone inválido" : "");
    } else if (field === "endereco_uf") {
      v = value.toUpperCase().slice(0, 2);
    }
    setForm((prev) => ({ ...prev, [field]: v }));
  };

  const missingIdentificacao = [!form.nome, !form.cpf.replace(/\D/g, "")].filter(Boolean).length;
  const missingContato = [!form.email, !form.telefone.replace(/\D/g, "")].filter(Boolean).length;

  const handleSave = async () => {
    if (cpfError || telefoneError) return;
    setSaving(true);

    const cleanCPF = form.cpf.replace(/\D/g, "");
    const cleanPhone = form.telefone.replace(/\D/g, "");

    if (cleanCPF && !validateCPF(cleanCPF)) { toast.error("CPF inválido"); setSaving(false); return; }
    if (cleanPhone && !validatePhone(cleanPhone)) { toast.error("Telefone inválido"); setSaving(false); return; }

    const { error } = await supabase.from("profiles").update({
      nome: form.nome,
      cpf: cleanCPF || null,
      telefone: cleanPhone || null,
      cep: form.cep || null,
      data_nascimento: form.data_nascimento || null,
      endereco_rua: form.endereco_rua,
      endereco_numero: form.endereco_numero,
      endereco_bairro: form.endereco_bairro,
      endereco_cidade: form.endereco_cidade,
      endereco_uf: form.endereco_uf,
    } as any).eq("id", userId);

    if (error) {
      if ((error as any).code === "23505") {
        toast.error(
          (error as any).message?.includes("cpf")
            ? "Este CPF já está cadastrado em outra conta"
            : "Estes dados já estão cadastrados em outra conta"
        );
      } else {
        toast.error("Erro ao salvar");
      }
      console.error(error);
    } else {
      // Update email if changed — compara com o e-mail REAL da conta (não com o cache local)
      const newEmail = form.email.trim().toLowerCase();
      const { data: authData } = await supabase.auth.getUser();
      const currentEmail = (authData?.user?.email || original.email).trim().toLowerCase();
      if (newEmail && newEmail !== currentEmail) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail });
        if (emailErr) {
          const msg = (emailErr.message || "").toLowerCase();
          toast.error(
            msg.includes("already been registered") || msg.includes("already registered")
              ? "Este e-mail já está em uso por outra conta"
              : "Não foi possível atualizar o e-mail"
          );
          setSaving(false);
          return;
        }
        toast.success("Confirme o novo e-mail pelo link enviado");
        setOriginal({ ...form, email: newEmail });
        setForm((p) => ({ ...p, email: newEmail }));
        setSaving(false);
        return;
      }
      toast.success("Dados atualizados!");
      setOriginal(form);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#FBFBFA] dark:bg-background relative overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-5 pt-[max(calc(env(safe-area-inset-top,0px)+1.5rem),2rem)] pb-32">
        {/* Header no mesmo padrão do agendamento — Botão circular sem barra cortando */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/cliente/perfil")}
            className="w-10 h-10 rounded-full bg-white dark:bg-card border border-neutral-200/70 dark:border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
            aria-label="Voltar"
          >
            <BackArrow size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* Título da tela idêntico ao padrão de agendamento */}
        <div className="mb-6">
          <h1 className="text-[25px] sm:text-[27px] font-bold text-neutral-900 dark:text-foreground tracking-tight leading-tight font-sans">
            Meus Dados
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-muted-foreground mt-1">
            Informações cadastrais e dados de contato
          </p>
        </div>

        {/* Name highlight card */}
        <div className="mb-4 px-5 py-4 rounded-2xl bg-white dark:bg-card border border-neutral-200/70 dark:border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">Nome completo</p>
          <p className="text-[17px] font-semibold text-neutral-900 dark:text-foreground mt-1">{form.nome || "—"}</p>
        </div>

        {/* Accordions */}
        <div className="rounded-2xl border border-neutral-200/70 dark:border-border/60 bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden mb-6">
        {/* Identificação */}
        <AccordionSection
          icon={User}
          title="Identificação"
          subtitle={form.cpf || "Preencher CPF"}
          missingCount={missingIdentificacao}
        >
          <CompactField label="Nome Completo" value={form.nome} onChange={(v) => set("nome", v)} required placeholder="Seu nome" />
          <CompactField label="CPF" value={form.cpf} onChange={(v) => set("cpf", v)} required placeholder="000.000.000-00" maxLength={14} error={cpfError} />
          <CompactField label="Data de Nascimento" value={form.data_nascimento} onChange={(v) => set("data_nascimento", v)} type="date" />
        </AccordionSection>

        {/* Contato */}
        <AccordionSection
          icon={Phone}
          title="Contato"
          subtitle={form.email || "Preencher e-mail"}
          missingCount={missingContato}
        >
          <CompactField label="E-mail" value={form.email} onChange={(v) => set("email", v)} required placeholder="seu@email.com" type="email" />
          <CompactField label="Telefone / WhatsApp" value={form.telefone} onChange={(v) => set("telefone", v)} required placeholder="(99) 99999-9999" maxLength={15} error={telefoneError} />
        </AccordionSection>

        {/* Endereço */}
        <AccordionSection
          icon={MapPin}
          title="Endereço"
          subtitle={form.endereco_cidade ? `${form.endereco_cidade} - ${form.endereco_uf}` : "Opcional"}
        >
          <CompactField label="CEP" value={form.cep} onChange={(v) => set("cep", v)} placeholder="00000-000" maxLength={9} />
          <div className="grid grid-cols-3 gap-2">
            <CompactField label="Rua" value={form.endereco_rua} onChange={(v) => set("endereco_rua", v)} placeholder="Rua / Av" className="col-span-2" />
            <CompactField label="Nº" value={form.endereco_numero} onChange={(v) => set("endereco_numero", v)} placeholder="123" />
          </div>
          <CompactField label="Bairro" value={form.endereco_bairro} onChange={(v) => set("endereco_bairro", v)} placeholder="Bairro" />
          <div className="grid grid-cols-3 gap-2">
            <CompactField label="Cidade" value={form.endereco_cidade} onChange={(v) => set("endereco_cidade", v)} placeholder="Cidade" className="col-span-2" />
            <CompactField label="UF" value={form.endereco_uf} onChange={(v) => set("endereco_uf", v)} placeholder="SP" maxLength={2} />
          </div>
        </AccordionSection>
      </div>

      {/* Floating save bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed left-0 right-0 px-5 z-30"
            style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <button
              onClick={handleSave}
              disabled={saving || !!cpfError || !!telefoneError}
              className="w-full h-12 rounded-xl bg-neutral-900 text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
