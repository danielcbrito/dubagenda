import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Loader2, Unlink } from "lucide-react";

interface BarberGoogleCalendarProps {
  barbeiroId: string;
}

export function BarberGoogleCalendar({ barbeiroId }: BarberGoogleCalendarProps) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('barbeiros').select('google_calendar_connected').eq('id', barbeiroId).single().then(({ data }) => setConnected(data?.google_calendar_connected || false));
  }, [barbeiroId]);

  const handleConnect = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('google-calendar-auth', { body: { action: 'get_auth_url', barbeiroId, redirectUri: `${window.location.origin}/barbeiro/google-calendar` } });
    if (data?.authUrl) window.location.href = data.authUrl;
    else { toast.error(data?.error || 'Erro'); setLoading(false); }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    await supabase.functions.invoke('google-calendar-auth', { body: { action: 'disconnect', barbeiroId } });
    setConnected(false);
    setLoading(false);
    toast.success('Desconectado');
  };

  // Process OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setLoading(true);
      supabase.functions.invoke('google-calendar-auth', { body: { action: 'exchange_code', barbeiroId, code, redirectUri: `${window.location.origin}/barbeiro/google-calendar` } }).then(({ data }) => {
        if (data?.success) { setConnected(true); toast.success('Conectado!'); }
        else toast.error(data?.error || 'Erro');
        setLoading(false);
        window.history.replaceState({}, '', '/barbeiro/google-calendar');
      });
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Google Calendar</h1>
      <Card className="bg-card/50 border-border/50 max-w-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Sincronização</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-500" /><span className="text-green-500 font-medium">Conectado</span></div>
              <p className="text-sm text-muted-foreground">Seus agendamentos serão sincronizados automaticamente.</p>
              <Button variant="outline" onClick={handleDisconnect} disabled={loading}><Unlink className="h-4 w-4 mr-2" />Desconectar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Conecte seu Google Calendar para receber seus agendamentos automaticamente.</p>
              <Button onClick={handleConnect} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}Conectar Google Calendar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
