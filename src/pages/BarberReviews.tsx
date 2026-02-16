import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, User, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_first_name: string;
  created_at: string;
}

const BarberReviews = () => {
  const navigate = useNavigate();
  const { barberId } = useParams<{ barberId: string }>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [barber, setBarber] = useState<{ apelido: string; foto_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    if (!barberId) return;

    const load = async () => {
      setLoading(true);

      const [barberRes, reviewsRes] = await Promise.all([
        supabase
          .from("barbeiros")
          .select("apelido, foto_url")
          .eq("id", barberId)
          .single(),
        supabase
          .from("barbeiro_avaliacoes")
          .select("id, rating, comment, reviewer_first_name, created_at")
          .eq("barber_id", barberId)
          .order("created_at", { ascending: false }),
      ]);

      if (barberRes.data) setBarber(barberRes.data);

      const data = reviewsRes.data || [];
      setReviews(data);

      if (data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }

      setLoading(false);
    };

    load();
  }, [barberId]);

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    percent: reviews.length > 0
      ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100
      : 0,
  }));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Avaliações</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-muted/30 animate-pulse" />
            <div className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
            <div className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
          </div>
        ) : (
          <>
            {/* Barbeiro + Resumo */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-primary/30 flex-shrink-0">
                  {barber?.foto_url ? (
                    <img
                      src={barber.foto_url}
                      alt={barber.apelido}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/15 flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {barber?.apelido || "Barbeiro"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= Math.round(averageRating)
                              ? "fill-primary text-primary"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Distribuição */}
              <div className="space-y-2">
                {ratingDistribution.map(({ star, count, percent }) => (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 text-right">
                      {star}
                    </span>
                    <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Lista de avaliações */}
            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  Nenhuma avaliação ainda
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review, index) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {review.reviewer_first_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {review.reviewer_first_name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex gap-0.5 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating
                              ? "fill-primary text-primary"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>

                    {review.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BarberReviews;
