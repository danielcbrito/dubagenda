import { useState, useEffect, useRef } from "react";
import { Star, User, Send, Camera, X, Loader2 } from "lucide-react";
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
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user already has a review for this barber
  useEffect(() => {
    if (!open || !userId || !barberId) return;
    const checkExisting = async () => {
      const { data } = await supabase
        .from("barbeiro_avaliacoes")
        .select("*")
        .eq("user_id", userId)
        .eq("barber_id", barberId)
        .maybeSingle();

      if (data) {
        setExistingReviewId(data.id);
        setRating(data.rating);
        setComment(data.comment || "");
        if ((data as any).foto_url) {
          setPhotoPreview((data as any).foto_url);
        }
        setIsEditing(true);
      } else {
        setExistingReviewId(null);
        setRating(0);
        setComment("");
        setPhotoFile(null);
        setPhotoPreview(null);
        setIsEditing(false);
      }
    };
    checkExisting();
  }, [open, userId, barberId]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 10MB");
      return;
    }

    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Selecione uma nota de 1 a 5 estrelas");
      return;
    }

    setSubmitting(true);
    try {
      const firstName = userName.split(" ")[0] || "Cliente";

      // 1. Upload photo if selected
      let uploadedPhotoUrl = photoPreview && !photoFile ? photoPreview : null;
      if (photoFile) {
        try {
          const fileExt = photoFile.name.split(".").pop() || "jpg";
          const fileName = `review-${userId}-${Date.now()}.${fileExt}`;
          
          // Try upload to portfolio or review-photos bucket
          const { error: uploadError } = await supabase.storage
            .from("portfolio")
            .upload(fileName, photoFile, { upsert: true });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from("portfolio")
              .getPublicUrl(fileName);
            uploadedPhotoUrl = publicUrlData?.publicUrl || null;
          } else {
            console.warn("Storage upload warning, continuing without photo:", uploadError);
          }
        } catch (storageErr) {
          console.warn("Could not upload review photo:", storageErr);
        }
      }

      // 2. Discover appointment's servico_id to link review photo directly to service
      let servicoId: string | null = null;
      if (appointmentId) {
        try {
          const { data: appt } = await supabase
            .from("agendamentos")
            .select("servico_id")
            .eq("id", appointmentId)
            .maybeSingle();
          servicoId = appt?.servico_id || null;
        } catch (e) {
          console.warn("Could not query appointment servico_id:", e);
        }
      }

      const reviewPayload: any = {
        appointment_id: appointmentId,
        barber_id: barberId,
        user_id: userId,
        rating,
        comment: comment.trim() || null,
        reviewer_first_name: firstName,
      };

      if (uploadedPhotoUrl) {
        reviewPayload.foto_url = uploadedPhotoUrl;
      }
      if (servicoId) {
        reviewPayload.servico_id = servicoId;
      }

      if (existingReviewId) {
        // Update existing review
        const { error } = await supabase
          .from("barbeiro_avaliacoes")
          .update(reviewPayload)
          .eq("id", existingReviewId);

        if (error) {
          // If columns don't exist yet on Supabase, retry with basic fields
          const fallbackPayload = {
            rating,
            comment: comment.trim() || null,
            appointment_id: appointmentId,
          };
          const { error: fallbackError } = await supabase
            .from("barbeiro_avaliacoes")
            .update(fallbackPayload)
            .eq("id", existingReviewId);
          if (fallbackError) throw fallbackError;
        }
        toast.success("Avaliação atualizada!");
      } else {
        // Insert new review
        const { error } = await supabase
          .from("barbeiro_avaliacoes")
          .insert(reviewPayload);

        if (error) {
          if (error.code === "23505") {
            toast.info("Você já avaliou este barbeiro. Sua avaliação foi mantida.");
          } else {
            // Retry with base payload if new columns not yet in DB schema
            const basePayload = {
              appointment_id: appointmentId,
              barber_id: barberId,
              user_id: userId,
              rating,
              comment: comment.trim() || null,
              reviewer_first_name: firstName,
            };
            const { error: fallbackError } = await supabase
              .from("barbeiro_avaliacoes")
              .insert(basePayload);
            if (fallbackError) throw fallbackError;
            toast.success("Avaliação enviada com sucesso!");
          }
        } else {
          toast.success("Avaliação enviada com sucesso!");
        }
      }

      setRating(0);
      setComment("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setExistingReviewId(null);
      setIsEditing(false);
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
            {isEditing ? `Editar avaliação de ${barberName}` : `Como foi com ${barberName}?`}
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            {isEditing
              ? "Você já avaliou este barbeiro. Atualize se quiser."
              : "Sua avaliação ajuda outros clientes"}
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

        {/* Campo de observação e foto do corte */}
        <div className="px-6 pb-6 space-y-3.5">
          <Textarea
            placeholder="Deixe uma observação (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            className="bg-secondary border-border resize-none h-20 rounded-xl text-sm"
          />

          {/* Upload de foto do corte */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {photoPreview ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/50 border border-border">
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={photoPreview} alt="Prévia" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-foreground truncate">Foto do corte anexada</p>
                  <p className="text-[11px] text-muted-foreground">Aparecerá na avaliação e no serviço</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="w-8 h-8 rounded-full bg-secondary hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-border/80 bg-secondary/30 hover:bg-secondary/60 text-foreground/80 flex items-center justify-center gap-2 text-[12.5px] font-medium active:scale-[0.98] transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4 text-primary" />
                <span>Adicionar foto do corte (opcional)</span>
              </button>
            )}
          </div>

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
                {isEditing ? "Atualizar Avaliação" : "Enviar Avaliação"}
              </>
            )}
          </Button>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            {isEditing ? "Manter avaliação atual" : "Não quero avaliar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
