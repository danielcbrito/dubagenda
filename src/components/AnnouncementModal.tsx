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
import { AlertCircle } from "lucide-react";

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
        className="max-w-[420px] border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(212, 49, 49, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Top reflection line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        <div className="p-8">
          <AlertDialogHeader>
            <div className="flex items-start gap-4 mb-4">
              {/* Premium icon with glow */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
                <div 
                  className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, hsl(0 64% 62%), hsl(0 64% 52%))',
                    boxShadow: '0 8px 24px rgba(212,49,49,0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <AlertCircle className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              </div>
              
              <div className="flex-1">
                <AlertDialogTitle className="text-xl font-bold text-foreground mb-2 tracking-tight">
                  Atenção
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-foreground/80 leading-relaxed font-normal">
                  Este app está em teste. Para qualquer erro ou dúvida, entre em contato com o suporte.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          
          <AlertDialogFooter className="mt-6">
            <Button 
              onClick={handleClose}
              className="relative w-full h-12 font-semibold tracking-wide text-white border-0 overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                boxShadow: '0 8px 24px rgba(212,49,49,0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
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
