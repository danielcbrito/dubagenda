import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AIActionLog {
  id: string;
  created_at: string;
  action_type: string;
  action_name: string;
  parameters: any;
  result: any;
  success: boolean;
  error_message: string;
  user_id: string;
}

export function AdminSuporteLogsIA() {
  const [logs, setLogs] = useState<AIActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSuccess, setFilterSuccess] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
    
    // Atualizar a cada 10 segundos
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [filterType, filterSuccess]);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('ai_actions_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterType !== 'all') {
        query = query.eq('action_type', filterType);
      }

      if (filterSuccess !== 'all') {
        query = query.eq('success', filterSuccess === 'success');
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      toast({
        title: "Erro ao carregar logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action_name.toLowerCase().includes(term) ||
      log.user_id?.toLowerCase().includes(term) ||
      log.error_message?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ação, usuário, erro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="function_call">Function Call</SelectItem>
              <SelectItem value="diagnostic">Diagnóstico</SelectItem>
              <SelectItem value="remediation">Remediação</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSuccess} onValueChange={setFilterSuccess}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por resultado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os resultados</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="failure">Falha</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Logs */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <Card className="p-8 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum log encontrado</h3>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros ou aguarde novas ações
            </p>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex items-start gap-4">
                {/* Ícone de status */}
                <div className="mt-1">
                  {log.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {log.action_name}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {log.action_type}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                      <Clock className="h-3 w-3" />
                      {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </div>
                  </div>

                  {log.user_id && (
                    <p className="text-xs text-muted-foreground">
                      Usuário: {log.user_id.substring(0, 8)}...
                    </p>
                  )}

                  {log.error_message && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="text-xs text-red-400 font-medium mb-1">Erro:</p>
                      <p className="text-xs text-red-300 font-mono">{log.error_message}</p>
                    </div>
                  )}

                  {log.parameters && Object.keys(log.parameters).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver parâmetros
                      </summary>
                      <pre className="mt-2 bg-muted/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.parameters, null, 2)}
                      </pre>
                    </details>
                  )}

                  {log.result && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver resultado
                      </summary>
                      <pre className="mt-2 bg-muted/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}