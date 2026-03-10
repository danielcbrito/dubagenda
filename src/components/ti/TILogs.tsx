import { useState, useEffect } from "react";
import { 
  FileText, 
  RefreshCw, 
  Search, 
  Filter,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Download
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SystemLog {
  id: string;
  level: string;
  category: string;
  message: string;
  details?: any;
  created_at: string;
  user_id?: string;
}

export function TILogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "info":
        return <Info className="w-4 h-4 text-blue-400" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "critical":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      error: "bg-red-500/10 text-red-400 border-red-500/20",
      critical: "bg-red-600/20 text-red-500 border-red-600/30",
    };
    return (
      <Badge className={styles[level] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}>
        {level}
      </Badge>
    );
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const categories = [...new Set(logs.map(log => log.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-wide text-foreground">
            <span className="text-cyan-400">Logs</span> do Sistema
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitore eventos e erros do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2 border-cyan-500/30 hover:bg-cyan-500/10"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button 
            onClick={loadLogs} 
            disabled={loading}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nos logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#12121a] border-cyan-500/20 focus:border-cyan-500/50"
          />
        </div>
        
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[150px] bg-[#12121a] border-cyan-500/20">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent className="bg-[#12121a] border-cyan-500/20">
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] bg-[#12121a] border-cyan-500/20">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="bg-[#12121a] border-cyan-500/20">
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", count: logs.length, color: "cyan" },
          { label: "Info", count: logs.filter(l => l.level === "info").length, color: "blue" },
          { label: "Warning", count: logs.filter(l => l.level === "warning").length, color: "yellow" },
          { label: "Erros", count: logs.filter(l => l.level === "error" || l.level === "critical").length, color: "red" },
        ].map((stat, index) => (
          <Card 
            key={index}
            className={`p-4 bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-${stat.color}-500/10`}
          >
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Logs List */}
      <Card className="bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10 overflow-hidden">
        <div className="p-4 border-b border-cyan-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold">Registros</span>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
              {filteredLogs.length}
            </Badge>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-450px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-cyan-500/5">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 hover:bg-cyan-500/5 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getLevelBadge(log.level)}
                        <Badge variant="outline" className="text-xs">
                          {log.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm">{log.message}</p>
                      {log.details && (
                        <pre className="mt-2 text-xs text-muted-foreground bg-black/20 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
