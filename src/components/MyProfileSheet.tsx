import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { User, Mail, CreditCard, Calendar, Lock, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MyProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  profile: any;
  onProfileUpdate: () => void;
}

export function MyProfileSheet({ open, onOpenChange, userId, profile, onProfileUpdate }: MyProfileSheetProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: ""
  });
  const [userEmail, setUserEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  useEffect(() => {
    if (open && profile) {
      setFormData({
        nome: profile.nome || "",
        email: userEmail || "",
        cpf: profile.cpf || ""
      });
      loadUserData();
    }
  }, [open, profile]);

  const loadUserData = async () => {
    if (!userId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || "");
      setCreatedAt(user.created_at || "");
      setFormData(prev => ({ ...prev, email: user.email || "" }));
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setLoading(true);

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        nome: formData.nome,
        cpf: formData.cpf
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      toast.error("Erro ao atualizar perfil");
      setLoading(false);
      return;
    }

    // Update email if changed
    if (formData.email !== userEmail) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: formData.email
      });

      if (emailError) {
        console.error("Error updating email:", emailError);
        toast.error("Erro ao atualizar e-mail");
        setLoading(false);
        return;
      }
    }

    toast.success("Perfil atualizado com sucesso!");
    setEditing(false);
    onProfileUpdate();
    setLoading(false);
  };

  const handleCancel = () => {
    setFormData({
      nome: profile?.nome || "",
      email: userEmail || "",
      cpf: profile?.cpf || ""
    });
    setEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-[10px] z-[100]">
        <SheetHeader>
          <SheetTitle className="text-lg">Meu Perfil</SheetTitle>
          <SheetDescription className="sr-only">
            Visualize e edite suas informações pessoais
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 overflow-y-auto h-[calc(85vh-80px)] pb-6">
          <Card className="p-5 border-0 shadow-elegant">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Nome completo
                  </Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    disabled={!editing}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    E-mail
                  </Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!editing}
                    type="email"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" />
                    CPF
                  </Label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    disabled={!editing}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" />
                    Senha
                  </Label>
                  <Input
                    value="••••••••"
                    disabled
                    type="password"
                    className="h-10 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs hover:bg-primary/10 transition-all duration-300"
                    onClick={() => toast.info("Alteração de senha em breve")}
                  >
                    Alterar senha
                  </Button>
                </div>

                {createdAt && (
                  <div className="pt-3 border-t border-border/20">
                    <Label className="text-xs flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      Membro desde {format(new Date(createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </Label>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {!editing ? (
                  <Button
                    onClick={() => setEditing(true)}
                    className="flex-1 h-11 bg-primary hover:bg-primary/90 transition-all duration-300"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editar Informações
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleCancel}
                      variant="ghost"
                      className="flex-1 h-11 hover:bg-destructive/10 text-destructive transition-all duration-300"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex-1 h-11 bg-primary hover:bg-primary/90 transition-all duration-300"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
