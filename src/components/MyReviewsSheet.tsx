import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  barber_name: string;
  barber_photo: string | null;
}

interface MyReviewsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export function MyReviewsSheet({ open, onOpenChange, userId }: MyReviewsSheetProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) loadReviews();
  }, [open, userId]);

  const loadReviews = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("barbeiro_avaliacoes")
        .select("id, rating, comment, created_at, barber_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        setReviews([]);
        return;
      }

      const barberIds = [...new Set(data.map((r) => r.barber_id))];
      const { data: barbers } = await supabase
        .from("barbeiros")
        .select("id, apelido, foto_url")
        .in("id", barberIds);

      const barberMap = new Map(
        (barbers || []).map((b) => [b.id, { name: b.apelido, photo: b.foto_url }])
      );

      setReviews(
        data.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          barber_name: barberMap.get(r.barber_id)?.name || "Barbeiro",
          barber_photo: barberMap.get(r.barber_id)?.photo || null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "h-3.5 w-3.5",
            s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"
          )}
        />
      ))}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <SheetTitle className="text-[15px] font-semibold">Minhas Avaliações</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-8 px-4 pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <Star className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground/60 text-center">
                Você ainda não avaliou nenhum barbeiro.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review, i) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl bg-card border border-border/30 p-3.5 space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-secondary/50 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {review.barber_photo ? (
                        <img
                          src={supabase.storage.from("barbeiros").getPublicUrl(review.barber_photo).data.publicUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[11px] font-bold text-muted-foreground">
                          {review.barber_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">
                        {review.barber_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50">
                        {format(new Date(review.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    {renderStars(review.rating)}
                  </div>
                  {review.comment && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed pl-[46px]">
                      "{review.comment}"
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
