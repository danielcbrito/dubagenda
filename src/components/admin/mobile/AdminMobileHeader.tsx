import { Menu, Bell, LogOut } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdminMobileHeaderProps {
  onMenuClick: () => void;
  pendingCount: number;
  currentTitle?: string;
}

export function AdminMobileHeader({ 
  onMenuClick, 
  pendingCount,
  currentTitle = "Visão Geral"
}: AdminMobileHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Glassmorphism background */}
      <div 
        className="backdrop-blur-xl border-b border-border/30"
        style={{
          background: 'linear-gradient(180deg, rgba(30,30,34,0.98) 0%, rgba(30,30,34,0.92) 100%)'
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Menu Button + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className={cn(
                "relative w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-secondary/50 hover:bg-secondary",
                "border border-border/50 hover:border-primary/30",
                "transition-all duration-300",
                "active:scale-95"
              )}
            >
              <Menu className="w-5 h-5 text-foreground" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-glow-red" />
              )}
            </button>
            
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img 
                  src={logoDub} 
                  alt="DUB" 
                  className="w-8 h-8 object-contain drop-shadow-[0_0_6px_rgba(255,59,59,0.3)]" 
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-wide text-foreground">DUB</span>
                <span className="text-[9px] text-muted-foreground/70 tracking-widest uppercase -mt-0.5">Admin</span>
              </div>
            </div>
          </div>

          {/* Current Page Title (opcional) */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-xs font-medium text-muted-foreground/80 tracking-wide">
              {currentTitle}
            </span>
          </div>

          {/* Right Actions - Notifications */}
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge 
                className="text-[10px] h-5 px-2 bg-primary/15 text-primary border-0 shadow-glow-red animate-pulse"
              >
                {pendingCount > 9 ? "9+" : pendingCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
