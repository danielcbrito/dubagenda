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
      <AlertDialogContent className="max-w-[400px] rounded-2xl border border-border/50 bg-card p-6">
        <AlertDialogHeader>
          <div className="flex items-start gap-3 mb-2">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                boxShadow: '0 4px 12px rgba(212,49,49,0.25)'
              }}
            >
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-semibold text-foreground mb-1">
                Atenção
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-foreground/70 leading-relaxed">
                Este app está em teste. Para qualquer erro ou dúvida, entre em contato com o suporte.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <Button 
            onClick={handleClose}
            className="w-full font-medium"
            style={{
              minHeight: '44px',
              background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
              boxShadow: '0 4px 12px rgba(212,49,49,0.25)'
            }}
          >
            Entendi
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
