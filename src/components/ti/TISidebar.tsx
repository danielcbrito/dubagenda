import { 
  LayoutDashboard, 
  Users, 
  Webhook, 
  Settings, 
  Shield, 
  LogOut,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Activity,
  Database,
  FileText,
  Wrench,
  Key
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  end?: boolean;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { 
    title: "Monitoramento", 
    url: "/ti", 
    icon: Activity, 
    end: true 
  },
  { 
    title: "Clientes", 
    url: "/ti/clientes", 
    icon: Users 
  },
  { 
    title: "Webhooks", 
    url: "/ti/webhooks", 
    icon: Webhook 
  },
  { 
    title: "Configurações", 
    url: "/ti/configuracoes", 
    icon: Settings 
  },
  { 
    title: "Logs do Sistema", 
    url: "/ti/logs", 
    icon: FileText 
  },
  { 
    title: "Manutenção", 
    url: "/ti/manutencao", 
    icon: Wrench 
  },
];

export function TISidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const isItemActive = (item: MenuItem) => {
    if (item.end) return location.pathname === item.url;
    return location.pathname.startsWith(item.url);
  };

  const toggleExpand = (title: string) => {
    setExpandedItems(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title) 
        : [...prev, title]
    );
  };

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  return (
    <aside className="h-screen w-[220px] flex-shrink-0 flex flex-col bg-[#1a1f2e] border-r border-[#2a3142]">
      {/* Header - Protheus Style */}
      <div className="h-12 flex items-center justify-between px-3 bg-gradient-to-r from-[#1e3a5f] to-[#1a2d4a] border-b border-[#2a3142]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white tracking-wide">SISTEMA TI</span>
            <span className="text-[9px] text-blue-300/70 tracking-wider">v2.0.0</span>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={handleBackToAdmin}
        className="mx-2 mt-2 h-8 flex items-center gap-2 px-2 text-xs text-gray-400 hover:text-white hover:bg-[#2a3142] rounded transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Voltar ao Admin</span>
      </button>

      {/* Separator */}
      <div className="mx-3 my-2 h-px bg-[#2a3142]" />

      {/* Menu */}
      <nav className="flex-1 px-2 py-1 overflow-y-auto scrollbar-none">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const isActive = isItemActive(item);
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.title);
            
            return (
              <div key={item.title}>
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={cn(
                      "w-full h-8 flex items-center gap-2 px-2 rounded text-left",
                      "text-xs font-medium transition-all duration-150",
                      isActive 
                        ? "bg-blue-600/20 text-blue-400 border-l-2 border-blue-500" 
                        : "text-gray-400 hover:text-white hover:bg-[#2a3142]"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.title}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                ) : (
                  <NavLink 
                    to={item.url} 
                    end={item.end}
                    className={cn(
                      "h-8 flex items-center gap-2 px-2 rounded",
                      "text-xs font-medium transition-all duration-150",
                      isActive 
                        ? "bg-blue-600/20 text-blue-400 border-l-2 border-blue-500" 
                        : "text-gray-400 hover:text-white hover:bg-[#2a3142]"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.title}</span>
                  </NavLink>
                )}

                {/* Children */}
                {hasChildren && isExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = location.pathname === child.url;
                      
                      return (
                        <NavLink
                          key={child.title}
                          to={child.url}
                          className={cn(
                            "h-7 flex items-center gap-2 px-2 rounded",
                            "text-[11px] font-medium transition-all duration-150",
                            isChildActive 
                              ? "bg-blue-600/10 text-blue-400" 
                              : "text-gray-500 hover:text-white hover:bg-[#2a3142]"
                          )}
                        >
                          <ChildIcon className="w-3.5 h-3.5" />
                          <span>{child.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer - Status */}
      <div className="p-2 border-t border-[#2a3142]">
        <div className="px-2 py-1.5 rounded bg-[#0d1117] border border-[#2a3142]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Status</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-400">Online</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
