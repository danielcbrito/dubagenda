import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Camera, Loader2, Shield } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function AdminPerfil() {
  const [barbeiro, setBarbeiro] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carregar profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      // Verificar se admin também é barbeiro (pode ter registro na tabela barbeiros)
      const { data: barbeiroData } = await supabase
        .from('barbeiros')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (barbeiroData) {
        setBarbeiro(barbeiroData);
      } else {
        // Se não existe, criar um registro de barbeiro para o admin
        const { data: newBarbeiro, error } = await supabase
          .from('barbeiros')
          .insert({
            user_id: user.id,
            apelido: profileData?.nome || 'Admin',
            email: user.email,
            telefone: profileData?.telefone,
            ativo: true,
            setup_completed: true
          })
          .select()
          .single();

        if (!error && newBarbeiro) {
          setBarbeiro(newBarbeiro);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!barbeiro) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('barbeiros')
        .update({ 
          apelido: barbeiro.apelido, 
          telefone: barbeiro.telefone 
        })
        .eq('id', barbeiro.id);

      if (error) throw error;
      
      // Atualizar também o profile
      if (profile) {
        await supabase
          .from('profiles')
          .update({ 
            nome: barbeiro.apelido,
            telefone: barbeiro.telefone 
          })
          .eq('id', profile.id);
      }

      toast.success('Perfil atualizado!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !barbeiro) return;

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem.');
      return;
    }

    setUploading(true);
    try {
      // Nome do arquivo: barbeiro_id + extensão
      const ext = file.name.split('.').pop();
      const fileName = `${barbeiro.id}.${ext}`;
      const filePath = `avatars/${fileName}`;

      // Deletar foto antiga se existir
      if (barbeiro?.foto_url) {
        const oldPath = barbeiro.foto_url.split('/').slice(-2).join('/');
        await supabase.storage.from('barber-photos').remove([oldPath]);
      }

      // Upload da nova foto
      const { error: uploadError } = await supabase.storage
        .from('barber-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('barber-photos')
        .getPublicUrl(filePath);

      // Atualizar barbeiro com nova URL
      const { error: updateError } = await supabase
        .from('barbeiros')
        .update({ foto_url: urlData.publicUrl })
        .eq('id', barbeiro.id);

      if (updateError) throw updateError;

      setBarbeiro({ ...barbeiro, foto_url: urlData.publicUrl });
      toast.success('Foto atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!barbeiro) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Erro ao carregar perfil</p>
      </div>
    );
  }

  const initials = barbeiro.apelido?.slice(0, 2).toUpperCase() || 'AD';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">Administrador</p>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card de Foto */}
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Foto de Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-primary/20">
                <AvatarImage src={barbeiro.foto_url} alt={barbeiro.apelido} />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              {/* Overlay de upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                ) : (
                  <Camera className="h-8 w-8 text-white" />
                )}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="border-primary/30 hover:bg-primary/10"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Alterar Foto
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Esta foto será exibida aos clientes na hora de escolher o barbeiro
            </p>
          </CardContent>
        </Card>

        {/* Card de Dados */}
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Apelido / Nome de exibição</Label>
              <Input 
                value={barbeiro.apelido || ''} 
                onChange={(e) => setBarbeiro({ ...barbeiro, apelido: e.target.value })} 
                placeholder="Como os clientes te conhecem"
                className="bg-background/50"
              />
            </div>
            
            <div>
              <Label>Telefone</Label>
              <Input 
                value={barbeiro.telefone || ''} 
                onChange={(e) => setBarbeiro({ ...barbeiro, telefone: e.target.value })} 
                placeholder="(00) 00000-0000"
                className="bg-background/50"
              />
            </div>
            
            <div>
              <Label>Email</Label>
              <Input 
                value={barbeiro.email || ''} 
                disabled 
                className="opacity-50 bg-background/30" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                O email não pode ser alterado
              </p>
            </div>
            
            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
