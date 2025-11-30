import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

export function AnnouncementModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen the announcement
    const hasSeenAnnouncement = localStorage.getItem("hasSeenAnnouncement");
    if (!hasSeenAnnouncement) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenAnnouncement", "true");
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent 
        className="max-w-[420px] border-0 p-0 overflow-hidden animate-scale-in"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(217, 65, 65, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Top reflection line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Close Button X - Premium */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-all duration-300 group z-10"
          aria-label="Fechar"
        >
          <X className="h-4 w-4 text-white/60 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
        </button>
        
        <div className="p-8">
          <AlertDialogHeader>
            <div className="flex flex-col items-center text-center gap-6 mb-2">
              {/* Premium SVG Icon com animação pulse */}
              <div className="relative animate-pulse" style={{ animationDuration: "2s" }}>
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
                <div 
                  className="relative w-14 h-14 rounded-full flex items-center justify-center border-2 border-primary/30"
                  style={{
                    background: 'rgba(217, 65, 65, 0.1)',
                    boxShadow: '0 0 30px rgba(217, 65, 65, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <AlertCircle className="h-7 w-7 text-primary drop-shadow-lg" />
                </div>
              </div>
              
              {/* Título Premium */}
              <div className="space-y-3">
                <AlertDialogTitle className="text-2xl font-semibold text-white tracking-tight">
                  Atenção
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[15px] text-white/80 leading-relaxed font-light max-w-sm">
                  Este app acabou de ser lançado, está em teste. Qualquer tipo de erro, entre em contato com nosso suporte.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          
          <AlertDialogFooter className="mt-8">
            <Button 
              onClick={handleClose}
              className="relative w-full h-12 font-semibold tracking-wide text-white border-0 overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                boxShadow: '0 8px 24px rgba(217,49,49,0.4), 0 0 20px rgba(217, 65, 65, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                borderRadius: '12px'
              }}
            >
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Entendi</span>
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
