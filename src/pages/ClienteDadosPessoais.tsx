import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
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
    <div className={cn("space-y-1", className)}>
      <label className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.1em] font-medium">
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
          "w-full h-8 px-2.5 bg-muted/30 border rounded-lg text-[12px] text-foreground placeholder:text-muted-foreground/40",
          "focus:outline-none focus:border-border/50 focus:ring-0 transition-colors",
          isEmpty && !error ? "border-destructive/40" : "border-border/30",
          error ? "border-destructive/60" : "",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {error && <p className="text-[9px] text-destructive">{error}</p>}
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
    <div className="border-b border-border/20 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[12px] font-medium text-foreground">{title}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground/60 truncate">{subtitle}</p>}
        </div>
        {(missingCount ?? 0) > 0 && (
          <span className="rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {missingCount}
          </span>
        )}
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground/50 transition-transform duration-200",
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
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-border/20">
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
      cpf: cleanCPF,
      telefone: cleanPhone,
      cep: form.cep,
      data_nascimento: form.data_nascimento || null,
      endereco_rua: form.endereco_rua,
      endereco_numero: form.endereco_numero,
      endereco_bairro: form.endereco_bairro,
      endereco_cidade: form.endereco_cidade,
      endereco_uf: form.endereco_uf,
    } as any).eq("id", userId);

    if (error) {
      toast.error("Erro ao salvar");
      console.error(error);
    } else {
      // Update email if changed
      if (form.email !== original.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: form.email });
        if (emailErr) { toast.error("Erro ao atualizar e-mail"); setSaving(false); return; }
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={() => navigate("/cliente/perfil")}
          className="h-7 w-7 rounded-md bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-foreground" />
        </button>
        <h1 className="text-[14px] font-semibold tracking-tight text-foreground">Meus Dados</h1>
      </div>

      {/* Name highlight card */}
      <div className="mx-4 mb-4 px-4 py-3 rounded-lg bg-card border border-border/30 shadow-sm">
        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.12em]">Nome completo</p>
        <p className="text-[15px] font-semibold text-foreground mt-1">{form.nome || "—"}</p>
      </div>

      {/* Accordions */}
      <div className="mx-4 rounded-xl border border-border/30 bg-card shadow-sm overflow-hidden">
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
              className={cn(
                "w-full h-10 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 shadow-lg transition-all",
                "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
