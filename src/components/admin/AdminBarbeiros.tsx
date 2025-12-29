import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Mail, 
  Phone,
  CheckCircle2,
  XCircle,
  Scissors
} from 'lucide-react';

interface Barbeiro {
  id: string;
  apelido: string;
  email: string | null;
  telefone: string | null;
  comissao_pct: number | null;
  ativo: boolean | null;
  setup_completed: boolean | null;
  google_calendar_connected: boolean | null;
  user_id: string | null;
  created_at: string | null;
  profiles?: {
    nome: string;
    telefone: string | null;
  } | null;
}

export default function AdminBarbeiros() {
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBarbeiro, setEditingBarbeiro] = useState<Barbeiro | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state (sem comissão - cada barbeiro tem sua própria parte financeira)
  const [formData, setFormData] = useState({
    nome: '',
    apelido: '',
    email: '',
    telefone: '',
    password: ''
  });

  useEffect(() => {
    loadBarbeiros();
  }, []);

  const loadBarbeiros = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const response = await supabase.functions.invoke('manage-barbers', {
        body: { action: 'list' }
      });

      if (response.error) throw response.error;
      if (response.data?.success) {
        setBarbeiros(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar barbeiros:', error);
      toast.error('Erro ao carregar lista de barbeiros');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.apelido || !formData.email) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!editingBarbeiro && !formData.password) {
      toast.error('Senha é obrigatória para novo barbeiro');
      return;
    }

    if (!editingBarbeiro && formData.password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      if (editingBarbeiro) {
        // Atualizar
        const response = await supabase.functions.invoke('manage-barbers', {
          body: {
            action: 'update',
            barbeiro_id: editingBarbeiro.id,
            apelido: formData.apelido,
            telefone: formData.telefone
          }
        });

        if (response.error) throw response.error;
        if (!response.data?.success) throw new Error(response.data?.error);

        toast.success('Barbeiro atualizado!');
      } else {
        // Criar
        const response = await supabase.functions.invoke('manage-barbers', {
          body: {
            action: 'create',
            nome: formData.nome,
            apelido: formData.apelido,
            email: formData.email,
            telefone: formData.telefone,
            password: formData.password
          }
        });

        if (response.error) throw response.error;
        if (!response.data?.success) throw new Error(response.data?.error);

        toast.success('Barbeiro criado! Ele já pode fazer login.');
      }

      setDialogOpen(false);
      resetForm();
      loadBarbeiros();
    } catch (error) {
      console.error('Erro ao salvar barbeiro:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar barbeiro');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (barbeiro: Barbeiro) => {
    try {
      const response = await supabase.functions.invoke('manage-barbers', {
        body: {
          action: 'delete',
          barbeiro_id: barbeiro.id
        }
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error);

      toast.success('Barbeiro removido!');
      loadBarbeiros();
    } catch (error) {
      console.error('Erro ao deletar barbeiro:', error);
      toast.error('Erro ao remover barbeiro');
    }
  };

  const handleToggleAtivo = async (barbeiro: Barbeiro) => {
    try {
      const response = await supabase.functions.invoke('manage-barbers', {
        body: {
          action: 'update',
          barbeiro_id: barbeiro.id,
          ativo: !barbeiro.ativo
        }
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error);

      toast.success(barbeiro.ativo ? 'Barbeiro desativado' : 'Barbeiro ativado');
      loadBarbeiros();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      apelido: '',
      email: '',
      telefone: '',
      password: ''
    });
    setEditingBarbeiro(null);
  };

  const openEditDialog = (barbeiro: Barbeiro) => {
    setEditingBarbeiro(barbeiro);
    setFormData({
      nome: barbeiro.profiles?.nome || barbeiro.apelido,
      apelido: barbeiro.apelido,
      email: barbeiro.email || '',
      telefone: barbeiro.telefone || barbeiro.profiles?.telefone || '',
      password: ''
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Gerenciar Barbeiros
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre e gerencie os barbeiros da sua barbearia
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Barbeiro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBarbeiro ? 'Editar Barbeiro' : 'Novo Barbeiro'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  placeholder="João da Silva"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  disabled={!!editingBarbeiro}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apelido">Apelido/Nome de Exibição *</Label>
                <Input
                  id="apelido"
                  placeholder="João Barber"
                  value={formData.apelido}
                  onChange={(e) => setFormData({ ...formData, apelido: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingBarbeiro}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(11) 99999-9999"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>

              {!editingBarbeiro && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Salvando...' : editingBarbeiro ? 'Atualizar' : 'Criar Barbeiro'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Barbeiros */}
      {barbeiros.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scissors className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nenhum barbeiro cadastrado
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Clique em "Novo Barbeiro" para começar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {barbeiros.map((barbeiro) => (
            <Card 
              key={barbeiro.id} 
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                !barbeiro.ativo ? 'opacity-60' : ''
              }`}
            >
              {/* Status Badge */}
              <div className="absolute top-3 right-3">
                <Badge variant={barbeiro.ativo ? 'default' : 'secondary'}>
                  {barbeiro.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Scissors className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="block">{barbeiro.apelido}</span>
                    {barbeiro.profiles?.nome && barbeiro.profiles.nome !== barbeiro.apelido && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {barbeiro.profiles.nome}
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Email */}
                {barbeiro.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{barbeiro.email}</span>
                  </div>
                )}

                {/* Telefone */}
                {(barbeiro.telefone || barbeiro.profiles?.telefone) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{barbeiro.telefone || barbeiro.profiles?.telefone}</span>
                  </div>
                )}

                {/* Status de Configuração */}
                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs">
                    {barbeiro.setup_completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">Setup</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-xs">
                    {barbeiro.google_calendar_connected ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">Calendar</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={barbeiro.ativo ?? false}
                      onCheckedChange={() => handleToggleAtivo(barbeiro)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {barbeiro.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(barbeiro)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover barbeiro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso irá remover permanentemente {barbeiro.apelido} e todo o histórico associado.
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(barbeiro)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
