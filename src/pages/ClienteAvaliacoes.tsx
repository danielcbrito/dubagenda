import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { BackArrow } from "@/components/ui/back-arrow";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  barber_name: string;
  barber_photo: string | null;
}

export default function ClienteAvaliacoes() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      } else {
        navigate("/auth");
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      loadReviews();
    }
  }, [userId]);

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
            s <= rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-200"
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="h-full w-full bg-[#FBFBFA] dark:bg-background relative overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-5 pt-[max(calc(env(safe-area-inset-top,0px)+1.5rem),2rem)] pb-32">
        {/* Header no mesmo padrão do agendamento — Botão circular sem barra cortando */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white dark:bg-card border border-neutral-200/70 dark:border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
            aria-label="Voltar"
          >
            <BackArrow size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* Título da tela idêntico ao padrão de agendamento */}
        <div className="mb-6">
          <h1 className="text-[25px] sm:text-[27px] font-bold text-neutral-900 dark:text-foreground tracking-tight leading-tight font-sans">
            Minhas Avaliações
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-muted-foreground mt-1">
            {reviews.length > 0
              ? `${reviews.length} ${reviews.length === 1 ? "avaliação realizada" : "avaliações realizadas"}`
              : "Notas e opiniões que você compartilhou"}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando avaliações...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-24">
            <Star className="w-9 h-9 mx-auto mb-3 text-neutral-400 dark:text-muted-foreground stroke-[1.5]" />
            <h3 className="text-[15px] font-medium text-neutral-900 dark:text-foreground">
              Nenhuma avaliação ainda
            </h3>
            <p className="text-[12px] text-neutral-400 dark:text-muted-foreground mt-1">
              Avalie seus cortes concluídos para compartilhar sua experiência.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {reviews.map((review, idx) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-2xl border border-neutral-200/70 dark:border-border/60 bg-white dark:bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-neutral-100 dark:bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 border border-neutral-200/50 dark:border-border/40">
                    {review.barber_photo ? (
                      <img
                        src={supabase.storage.from("barbeiros").getPublicUrl(review.barber_photo).data.publicUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[14px] font-bold text-neutral-700 dark:text-foreground">
                        {review.barber_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-neutral-900 dark:text-foreground truncate">
                      {review.barber_name}
                    </p>
                    <p className="text-[11.5px] text-neutral-400 dark:text-muted-foreground">
                      {format(new Date(review.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {review.comment && (
                  <div className="mt-3 p-3 rounded-xl bg-neutral-50 dark:bg-muted/30 text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed italic border border-neutral-100 dark:border-border/30">
                    "{review.comment}"
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}