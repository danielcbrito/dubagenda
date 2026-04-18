import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, ShieldCheck, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Barber {
  id: string;
  apelido: string;
}

interface Credential {
  barbeiro_id: string;
  ambiente: string;
  pix_key: string;
  ativo: boolean;
  test_connection_ok: boolean;
  test_connection_at: string | null;
  test_pix_ok: boolean;
  test_pix_at: string | null;
  test_pix_e2e_id: string | null;
  activated_at: string | null;
}

export default function AdminEfiCredenciais() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [credential, setCredential] = useState<Credential | null>(null);

  // Form
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [ambiente, setAmbiente] = useState<"prod" | "homolog">("prod");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");

  const [busy, setBusy] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setAuthorized(!!data);
      if (!data) toast.error("Acesso restrito a administradores");
    })();
  }, [navigate]);

  // Load barbers
  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const { data } = await supabase
        .from("barbeiros").select("id, apelido").eq("ativo", true).is("deleted_at", null).order("apelido");
      setBarbers(data || []);
    })();
  }, [authorized]);

  // Load existing credential when barber changes
  useEffect(() => {
    if (!selectedBarber) { setCredential(null); return; }
    (async () => {
      const { data } = await supabase
        .from("efi_credenciais").select("*").eq("barbeiro_id", selectedBarber).maybeSingle();
      setCredential(data as any);
      if (data) {
        setPixKey(data.pix_key);
        setAmbiente(data.ambiente as any);
      } else {
        setPixKey(""); setAmbiente("prod");
      }
      setClientId(""); setClientSecret(""); setCertFile(null); setCertPassword("");
    })();
  }, [selectedBarber]);

  const refreshCredential = async () => {
    const { data } = await supabase
      .from("efi_credenciais").select("*").eq("barbeiro_id", selectedBarber).maybeSingle();
    setCredential(data as any);
  };

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // remove data:...;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const callFn = async (action: string, extra: Record<string, any> = {}) => {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke("efi-manage-credentials", {
        body: { action, barbeiro_id: selectedBarber, ...extra },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!selectedBarber) return toast.error("Selecione um barbeiro");
    if (!clientId || !clientSecret || !pixKey || !certFile || !certPassword) {
      return toast.error("Preencha todos os campos e anexe o .p12");
    }
    try {
      const cert_p12_base64 = await fileToBase64(certFile);
      await callFn("save", {
        client_id: clientId, client_secret: clientSecret,
        cert_p12_base64, cert_password: certPassword,
        pix_key: pixKey, ambiente,
      });
      toast.success("Credenciais salvas. Execute os testes.");
      await refreshCredential();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTestConnection = async () => {
    try {
      await callFn("test-connection");
      toast.success("Conexão mTLS OK");
      await refreshCredential();
    } catch (e: any) { toast.error(`Conexão falhou: ${e.message}`); await refreshCredential(); }
  };

  const handleTestPix = async () => {
    try {
      const r = await callFn("test-pix");
      toast.success(`PIX teste enviado! e2e: ${(r as any)?.e2e_id?.slice(0, 12)}...`);
      await refreshCredential();
    } catch (e: any) { toast.error(`Teste PIX falhou: ${e.message}`); await refreshCredential(); }
  };

  const handleActivate = async () => {
    try {
      await callFn("activate");
      toast.success("Conta PIX ativada! 🎉");
      await refreshCredential();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeactivate = async () => {
    try {
      await callFn("deactivate");
      toast.success("Conta desativada");
      await refreshCredential();
    } catch (e: any) { toast.error(e.message); }
  };

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!authorized) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Acesso negado</div>;
  }

  const canActivate = credential?.test_connection_ok && credential?.test_pix_ok;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Credenciais Efí Bank</h1>
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-6">ADMIN ONLY · MTLS + AES-GCM</p>

        {/* Barber selector */}
        <div className="mb-6">
          <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Barbeiro</Label>
          <select
            value={selectedBarber}
            onChange={(e) => setSelectedBarber(e.target.value)}
            className="mt-2 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione...</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.apelido}</option>)}
          </select>
        </div>

        {selectedBarber && (
          <>
            {/* Status atual */}
            {credential && (
              <div className="mb-6 rounded-lg border border-border p-4 bg-card space-y-2.5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">STATUS ATUAL</div>
                <StatusRow label="Conexão mTLS" ok={credential.test_connection_ok} at={credential.test_connection_at} />
                <StatusRow label="Teste PIX (R$ 0,01)" ok={credential.test_pix_ok} at={credential.test_pix_at} />
                <div className={cn(
                  "flex items-center justify-between pt-2 border-t border-border/50",
                  credential.ativo ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  <span className="text-sm font-semibold">
                    {credential.ativo ? "✅ ATIVA — clientes podem pagar via PIX" : "⏸ INATIVA"}
                  </span>
                </div>
              </div>
            )}

            {/* Form de cadastro */}
            <div className="space-y-4 rounded-lg border border-border p-4 bg-card">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                {credential ? "ATUALIZAR CREDENCIAIS" : "NOVAS CREDENCIAIS"}
              </div>

              <Field label="Client ID" value={clientId} onChange={setClientId} placeholder="Client_Id_xxxxxxxx" />
              <Field label="Client Secret" value={clientSecret} onChange={setClientSecret} type="password" placeholder="Client_Secret_xxxxxxxx" />
              <Field label="Chave PIX" value={pixKey} onChange={setPixKey} placeholder="email, CPF, celular ou aleatória" />

              <div>
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Ambiente</Label>
                <div className="mt-2 flex gap-2">
                  {(["prod", "homolog"] as const).map((a) => (
                    <button key={a} onClick={() => setAmbiente(a)}
                      className={cn("px-3 py-1.5 rounded-md text-xs font-medium border",
                        ambiente === a ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border")}>
                      {a === "prod" ? "Produção" : "Homologação"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Certificado .p12</Label>
                <label className="mt-2 flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border cursor-pointer hover:bg-muted/30">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground truncate">
                    {certFile ? certFile.name : "Selecionar arquivo .p12"}
                  </span>
                  <input type="file" accept=".p12,application/x-pkcs12" className="hidden"
                    onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <Field label="Senha do .p12" value={certPassword} onChange={setCertPassword} type="password" placeholder="Senha do certificado" />

              <Button onClick={handleSave} disabled={busy === "save"} className="w-full">
                {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {credential ? "Atualizar credenciais" : "Salvar credenciais"}
              </Button>
            </div>

            {/* Testes */}
            {credential && (
              <div className="mt-6 space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">TESTES OBRIGATÓRIOS</div>

                <Button onClick={handleTestConnection} disabled={busy === "test-connection"} variant="outline" className="w-full">
                  {busy === "test-connection" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  1. Testar conexão mTLS
                </Button>

                <Button onClick={handleTestPix} disabled={busy === "test-pix" || !credential.test_connection_ok} variant="outline" className="w-full">
                  {busy === "test-pix" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  2. Testar PIX (R$ 0,01 auto-envio)
                </Button>

                {!credential.ativo ? (
                  <Button onClick={handleActivate} disabled={busy === "activate" || !canActivate} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {busy === "activate" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    3. Ativar conta PIX
                  </Button>
                ) : (
                  <Button onClick={handleDeactivate} disabled={busy === "deactivate"} variant="destructive" className="w-full">
                    {busy === "deactivate" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Desativar conta
                  </Button>
                )}

                {!canActivate && (
                  <p className="text-xs text-muted-foreground text-center">
                    Execute e aprove os 2 testes acima para liberar a ativação.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2" />
    </div>
  );
}

function StatusRow({ label, ok, at }: { label: string; ok: boolean; at: string | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("flex items-center gap-1.5 font-medium", ok ? "text-emerald-500" : at ? "text-red-500" : "text-muted-foreground/50")}>
        {ok ? <CheckCircle2 className="w-4 h-4" /> : at ? <XCircle className="w-4 h-4" /> : null}
        {ok ? "OK" : at ? "Falhou" : "Pendente"}
      </span>
    </div>
  );
}
