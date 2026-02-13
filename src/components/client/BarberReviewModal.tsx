import { useState } from "react";
import { Star, User, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BarberReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  barberId: string;
  barberName: string;
  barberPhoto: string | null;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

export function BarberReviewModal({
  open,
  onOpenChange,
  appointmentId,
  barberId,
  barberName,
  barberPhoto,
  userId,
  userName,
  onSuccess,
}: BarberReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Selecione uma nota de 1 a 5 estrelas");
      return;
    }

    setSubmitting(true);
    try {
      const firstName = userName.split(" ")[0] || "Cliente";

      const { error } = await supabase.from("barbeiro_avaliacoes").insert({
        appointment_id: appointmentId,
        barber_id: barberId,
        user_id: userId,
        rating,
        comment: comment.trim() || null,
        reviewer_first_name: firstName,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Você já avaliou este atendimento");
        } else {
          throw error;
        }
      } else {
        toast.success("Avaliação enviada com sucesso!");
      }

      // Sempre fecha e chama onSuccess após (mesmo em duplicata)
      setRating(0);
      setComment("");
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao enviar avaliação:", err);
      toast.error("Erro ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto bg-card border-border rounded-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Avaliar barbeiro</DialogTitle>

        {/* Header com foto */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/30 mb-4">
            {barberPhoto ? (
              <img
                src={barberPhoto}
                alt={barberName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary/15 flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
            )}
          </div>

          <h3 className="text-lg font-bold text-foreground mb-1">
            Como foi com {barberName}?
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Sua avaliação ajuda outros clientes
          </p>
        </div>

        {/* Estrelas */}
        <div className="flex justify-center gap-2 pb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.button
              key={star}
              whileTap={{ scale: 0.85 }}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-colors"
            >
              <Star
                className={`w-9 h-9 transition-all duration-200 ${
                  star <= displayRating
                    ? "fill-primary text-primary"
                    : "text-muted-foreground/30"
                }`}
              />
            </motion.button>
          ))}
        </div>

        {/* Label da nota */}
        <AnimatePresence mode="wait">
          {displayRating > 0 && (
            <motion.p
              key={displayRating}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm font-medium text-primary pb-2"
            >
              {["", "Ruim", "Regular", "Bom", "Muito bom", "Excelente"][displayRating]}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Campo de observação */}
        <div className="px-6 pb-6 space-y-4">
          <Textarea
            placeholder="Deixe uma observação (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            className="bg-secondary border-border resize-none h-20 rounded-xl text-sm"
          />

          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full h-12 rounded-xl font-semibold"
          >
            {submitting ? (
              "Enviando..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Avaliação
              </>
            )}
          </Button>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Não quero avaliar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
