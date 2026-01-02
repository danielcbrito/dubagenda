import { useState, useEffect } from "react";
import { 
  Database, 
  Table, 
  Eye, 
  RefreshCw, 
  Search,
  ChevronRight,
  Rows,
  Hash,
  Type,
  Calendar,
  Users,
  CreditCard,
  Gift,
  FileText,
  Settings,
  MessageSquare
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TableInfo {
  name: string;
  icon: any;
  count: number;
  description: string;
  category: string;
}

export function TIDatabase() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const tableDefinitions = [
    { name: "profiles", icon: Users, description: "Perfis de usuários", category: "Usuários" },
    { name: "agendamentos", icon: Calendar, description: "Agendamentos de serviços", category: "Agendamentos" },
    { name: "servicos", icon: Settings, description: "Serviços oferecidos", category: "Serviços" },
    { name: "planos", icon: CreditCard, description: "Planos de assinatura", category: "Planos" },
    { name: "assinaturas", icon: CreditCard, description: "Assinaturas ativas", category: "Planos" },
    { name: "pagamentos", icon: CreditCard, description: "Histórico de pagamentos", category: "Financeiro" },
    { name: "promocoes", icon: Gift, description: "Promoções e descontos", category: "Promoções" },
    { name: "pontos", icon: Gift, description: "Pontos de fidelidade", category: "Promoções" },
    { name: "resgates", icon: Gift, description: "Resgates de prêmios", category: "Promoções" },
    { name: "barbeiros", icon: Users, description: "Barbeiros cadastrados", category: "Equipe" },
    { name: "configuracoes_horario", icon: Settings, description: "Horários de funcionamento", category: "Config" },
    { name: "notificacoes", icon: MessageSquare, description: "Notificações dos usuários", category: "Sistema" },
    { name: "support_conversations", icon: MessageSquare, description: "Conversas de suporte", category: "Suporte" },
    { name: "support_tickets", icon: FileText, description: "Tickets de suporte", category: "Suporte" },
    { name: "webhook_config", icon: Settings, description: "Configurações de webhook", category: "Config" },
    { name: "system_logs", icon: FileText, description: "Logs do sistema", category: "Sistema" },
    { name: "audit_logs", icon: FileText, description: "Logs de auditoria", category: "Sistema" },
  ];

  useEffect(() => {
    loadTableCounts();
  }, []);

  const loadTableCounts = async () => {
    setLoading(true);
    
    const tablesWithCounts = await Promise.all(
      tableDefinitions.map(async (table) => {
        try {
          const { count } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true });
          
          return {
            ...table,
            count: count || 0
          };
        } catch {
          return { ...table, count: 0 };
        }
      })
    );

    setTables(tablesWithCounts);
    setLoading(false);
  };

  const loadTableData = async (tableName: string) => {
    setTableLoading(true);
    setSelectedTable(tableName);

    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .limit(50)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTableData(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTableLoading(false);
    }
  };

  const filteredTables = tables.filter(table => 
    table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedTables = filteredTables.reduce((acc, table) => {
    if (!acc[table.category]) {
      acc[table.category] = [];
    }
    acc[table.category].push(table);
    return acc;
  }, {} as Record<string, TableInfo[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-wide text-foreground">
            <span className="text-cyan-400">Banco de</span> Dados
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualize e gerencie as tabelas do sistema
          </p>
        </div>
        <Button 
          onClick={loadTableCounts} 
          disabled={loading}
          variant="outline"
          className="gap-2 border-cyan-500/30 hover:bg-cyan-500/10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tabela..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#12121a] border-cyan-500/20 focus:border-cyan-500/50"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tables List */}
        <div className="lg:col-span-1 space-y-4">
          <ScrollArea className="h-[calc(100vh-300px)]">
            {Object.entries(groupedTables).map(([category, categoryTables]) => (
              <div key={category} className="mb-6">
                <h3 className="text-xs font-semibold text-cyan-400/70 uppercase tracking-wider mb-2 px-2">
                  {category}
                </h3>
                <div className="space-y-1">
                  {categoryTables.map((table) => {
                    const Icon = table.icon;
                    const isSelected = selectedTable === table.name;
                    
                    return (
                      <button
                        key={table.name}
                        onClick={() => loadTableData(table.name)}
                        className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-200 text-left ${
                          isSelected 
                            ? 'bg-cyan-500/20 border border-cyan-500/30' 
                            : 'bg-[#12121a] hover:bg-cyan-500/10 border border-transparent'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-400' : ''}`}>
                            {table.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {table.description}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {table.count}
                        </Badge>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Table Data Preview */}
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-300px)] bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10 overflow-hidden">
            {!selectedTable ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Database className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">Selecione uma tabela</p>
                <p className="text-sm">para visualizar os dados</p>
              </div>
            ) : tableLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Table Header */}
                <div className="p-4 border-b border-cyan-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table className="w-5 h-5 text-cyan-400" />
                    <span className="font-semibold">{selectedTable}</span>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                      {tableData.length} registros
                    </Badge>
                  </div>
                </div>

                {/* Table Content */}
                <ScrollArea className="flex-1">
                  {tableData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground p-8">
                      <p>Nenhum registro encontrado</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      {tableData.map((row, index) => (
                        <div 
                          key={index}
                          className="p-3 bg-black/20 rounded-lg border border-cyan-500/5 hover:border-cyan-500/20 transition-colors"
                        >
                          <pre className="text-xs text-muted-foreground overflow-x-auto">
                            {JSON.stringify(row, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
