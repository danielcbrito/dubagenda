import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Shield, 
  ShieldCheck, 
  Trash2, 
  RefreshCw, 
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConnectedDevice {
  id: string;
  device_fingerprint: string;
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address: string;
  last_activity: string;
  is_active: boolean;
  user_id: string;
}

interface AuthorizedDevice {
  id: string;
  device_fingerprint: string;
  device_name: string;
  device_type: string;
  descricao: string | null;
  created_at: string;
}

export function TIDispositivos() {
  const { deviceInfo, isLoading: deviceLoading } = useDeviceFingerprint();
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [authorizedDevices, setAuthorizedDevices] = useState<AuthorizedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Carregar dispositivos
  const loadDevices = async () => {
    try {
      // Dispositivos conectados
      const { data: connected, error: connError } = await supabase
        .from('dispositivos_conectados')
        .select('*')
        .order('last_activity', { ascending: false });

      if (connError) throw connError;
      setConnectedDevices(connected || []);

      // Dispositivos autorizados
      const { data: authorized, error: authError } = await supabase
        .from('dispositivos_autorizados')
        .select('*')
        .order('created_at', { ascending: false });

      if (authError) throw authError;
      setAuthorizedDevices(authorized || []);
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
      toast.error("Erro ao carregar dispositivos");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Registrar dispositivo atual
  const registerCurrentDevice = async () => {
    if (!deviceInfo) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('dispositivos_conectados')
        .upsert({
          user_id: user.id,
          device_fingerprint: deviceInfo.fingerprint,
          device_name: deviceInfo.deviceName,
          device_type: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          last_activity: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'user_id,device_fingerprint'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao registrar dispositivo:', error);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (deviceInfo) {
      registerCurrentDevice();
    }
  }, [deviceInfo]);

  // Realtime para dispositivos conectados
  useEffect(() => {
    const channel = supabase
      .channel('dispositivos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispositivos_conectados' },
        () => loadDevices()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispositivos_autorizados' },
        () => loadDevices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Autorizar dispositivo
  const authorizeDevice = async (device: ConnectedDevice) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('dispositivos_autorizados')
        .insert({
          device_fingerprint: device.device_fingerprint,
          device_name: device.device_name,
          device_type: device.device_type,
          autorizado_por: user?.id,
          descricao: `Autorizado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
        });

      if (error) {
        if (error.code === '23505') {
          toast.info("Este dispositivo já está autorizado");
          return;
        }
        throw error;
      }

      toast.success("Dispositivo autorizado com sucesso!");
      loadDevices();
    } catch (error) {
      console.error('Erro ao autorizar:', error);
      toast.error("Erro ao autorizar dispositivo");
    }
  };

  // Remover autorização
  const removeAuthorization = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('dispositivos_autorizados')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast.success("Autorização removida!");
      loadDevices();
    } catch (error) {
      console.error('Erro ao remover:', error);
      toast.error("Erro ao remover autorização");
    }
  };

  // Desconectar dispositivo
  const disconnectDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('dispositivos_conectados')
        .update({ is_active: false })
        .eq('id', deviceId);

      if (error) throw error;

      toast.success("Dispositivo desconectado!");
      loadDevices();
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast.error("Erro ao desconectar dispositivo");
    }
  };

  // Ícone do dispositivo
  const DeviceIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  // Verificar se dispositivo está autorizado
  const isDeviceAuthorized = (fingerprint: string) => {
    return authorizedDevices.some(d => d.device_fingerprint === fingerprint);
  };

  // Verificar se é o dispositivo atual
  const isCurrentDevice = (fingerprint: string) => {
    return deviceInfo?.fingerprint === fingerprint;
  };

  if (isLoading || deviceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-wide text-foreground">
            <span className="text-cyan-400">Dispositivos</span> Conectados
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie dispositivos conectados e autorizados para acesso durante manutenção
          </p>
        </div>
        <Button
          onClick={() => {
            setIsRefreshing(true);
            loadDevices();
          }}
          variant="outline"
          className="border-[#2a3142] text-gray-300 hover:bg-[#2a3142]"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Dispositivo Atual */}
      {deviceInfo && (
        <Card className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <DeviceIcon type={deviceInfo.deviceType} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{deviceInfo.deviceName}</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border-0">Este dispositivo</Badge>
                </div>
                <p className="text-xs text-gray-400">
                  Fingerprint: {deviceInfo.fingerprint}
                </p>
              </div>
            </div>
            {isDeviceAuthorized(deviceInfo.fingerprint) ? (
              <Badge className="bg-green-500/20 text-green-400 border-0">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Autorizado
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  const currentDevice = connectedDevices.find(
                    d => d.device_fingerprint === deviceInfo.fingerprint
                  );
                  if (currentDevice) {
                    authorizeDevice(currentDevice);
                  } else {
                    // Criar registro e autorizar
                    registerCurrentDevice().then(() => {
                      loadDevices().then(() => {
                        const device = connectedDevices.find(
                          d => d.device_fingerprint === deviceInfo.fingerprint
                        );
                        if (device) authorizeDevice(device);
                      });
                    });
                  }
                }}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                Autorizar
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Dispositivos Autorizados */}
      <Card className="p-6 bg-[#1a1f2e] border-[#2a3142]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Dispositivos Autorizados</h3>
            <p className="text-xs text-gray-400">
              Estes dispositivos podem acessar o sistema mesmo durante manutenção
            </p>
          </div>
        </div>

        {authorizedDevices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum dispositivo autorizado</p>
            <p className="text-xs mt-1">Autorize dispositivos para acessar durante manutenção</p>
          </div>
        ) : (
          <div className="space-y-3">
            {authorizedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 bg-[#0d1117] rounded-lg border border-[#2a3142]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#1a1f2e] flex items-center justify-center">
                    <DeviceIcon type={device.device_type} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{device.device_name}</span>
                      {isCurrentDevice(device.device_fingerprint) && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {device.descricao || `Adicionado ${formatDistanceToNow(new Date(device.created_at), { addSuffix: true, locale: ptBR })}`}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAuthorization(device.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Dispositivos Conectados */}
      <Card className="p-6 bg-[#1a1f2e] border-[#2a3142]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Dispositivos Conectados</h3>
            <p className="text-xs text-gray-400">
              Dispositivos que acessaram o sistema recentemente
            </p>
          </div>
        </div>

        {connectedDevices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <WifiOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum dispositivo conectado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connectedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 bg-[#0d1117] rounded-lg border border-[#2a3142]"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-[#1a1f2e] flex items-center justify-center">
                      <DeviceIcon type={device.device_type} />
                    </div>
                    {device.is_active && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d1117] animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{device.device_name}</span>
                      {isCurrentDevice(device.device_fingerprint) && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                          Atual
                        </Badge>
                      )}
                      {isDeviceAuthorized(device.device_fingerprint) && (
                        <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Autorizado
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(device.last_activity), { addSuffix: true, locale: ptBR })}
                      </span>
                      {device.ip_address && (
                        <span>IP: {device.ip_address}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isDeviceAuthorized(device.device_fingerprint) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => authorizeDevice(device)}
                      className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    >
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      Autorizar
                    </Button>
                  )}
                  {!isCurrentDevice(device.device_fingerprint) && device.is_active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disconnectDevice(device.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <WifiOff className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
