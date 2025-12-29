import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface BarberPerfilProps {
  barbeiroId: string;
}

export function BarberPerfil({ barbeiroId }: BarberPerfilProps) {
  const [barbeiro, setBarbeiro] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('barbeiros').select('*').eq('id', barbeiroId).single().then(({ data }) => setBarbeiro(data));
  }, [barbeiroId]);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from('barbeiros').update({ 
      apelido: barbeiro.apelido, 
      telefone: barbeiro.telefone 
    }).eq('id', barbeiroId);
    setLoading(false);
    if (error) toast.error('Erro ao salvar'); 
    else toast.success('Perfil atualizado!');
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
      const fileName = `${barbeiroId}.${ext}`;
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
        .eq('id', barbeiroId);

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

  if (!barbeiro) return null;

  const initials = barbeiro.apelido?.slice(0, 2).toUpperCase() || 'BB';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card de Foto */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
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
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
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
              />
            </div>
            
            <div>
              <Label>Telefone</Label>
              <Input 
                value={barbeiro.telefone || ''} 
                onChange={(e) => setBarbeiro({ ...barbeiro, telefone: e.target.value })} 
                placeholder="(00) 00000-0000"
              />
            </div>
            
            <div>
              <Label>Email</Label>
              <Input 
                value={barbeiro.email || ''} 
                disabled 
                className="opacity-50" 
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
