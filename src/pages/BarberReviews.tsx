import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Star, User, MessageSquare, Scissors, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { JsonLd } from "@/components/seo/JsonLd";
import { Helmet } from "react-helmet-async";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_first_name: string;
  created_at: string;
}

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a4 4 0 0 1 4 4v1" />
    </svg>
  );
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

  const reviewsLd = reviews.length > 0 && barber ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Avaliações de ${barber.apelido}`,
    image: barber.foto_url || undefined,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: averageRating,
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, 20).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.reviewer_first_name || "Cliente" },
      datePublished: r.created_at,
      reviewBody: r.comment || undefined,
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      itemReviewed: { "@type": "Person", name: barber.apelido },
    })),
  } : null;

  const pageTitle = barber
    ? `Avaliações de ${barber.apelido} — DUB Agenda`
    : "Avaliações do barbeiro — DUB Agenda";
  const pageDesc = barber
    ? `Leia ${reviews.length} avaliações reais de clientes sobre ${barber.apelido}. Nota média ${averageRating || "—"}/5 na DUB Agenda.`
    : "Leia avaliações reais de clientes sobre os barbeiros parceiros da DUB Agenda.";
  const canonical = `https://dubagenda.lovable.app/cliente/barbeiro/${barberId}/avaliacoes`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonical} />
      </Helmet>
      {reviewsLd && <JsonLd id="barber-reviews" data={reviewsLd} />}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-8">

        {/* ── Hero Section ── */}
        <div className="relative w-full" style={{ minHeight: barber?.foto_url ? 300 : 200 }}>
          {barber?.foto_url ? (
            <>
              <img
                src={barber.foto_url}
                alt={barber.apelido}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, transparent 0%, transparent 40%, hsl(var(--background) / 0.5) 70%, hsl(var(--background)) 100%)"
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)"
              }}
            >
              <div className="w-24 h-24 rounded-full bg-muted/30 border border-border/20 flex items-center justify-center">
                <User className="w-10 h-10 text-muted-foreground/40" />
              </div>
            </div>
          )}

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-10 w-10 h-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-md border border-border/30 active:scale-95 transition-all text-foreground"
          >
            <BackArrow />
          </button>
        </div>

        {/* ── Name + Rating Summary ── */}
        <div className="px-5 pt-5 pb-4">
          <h1 className="text-[22px] font-bold font-display text-foreground tracking-tight">
            {barber?.apelido || "Barbeiro"}
          </h1>

          <div className="flex items-center gap-2.5 mt-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "w-4 h-4",
                    star <= Math.round(averageRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/20"
                  )}
                />
              ))}
            </div>
            {reviews.length > 0 && (
              <span className="text-[13px] font-bold tabular-nums text-foreground">
                {averageRating.toFixed(1)}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {reviews.length > 0
                ? `${reviews.length} ${reviews.length === 1 ? "avaliação" : "avaliações"}`
                : "Sem avaliações"}
            </span>
          </div>
        </div>

        {/* ── Rating Distribution ── */}
        {!loading && reviews.length > 0 && (
          <div className="px-5 pb-5">
            <div className="rounded-xl bg-card border border-border/30 p-4">
              <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold mb-3">
                Distribuição
              </p>
              <div className="space-y-2">
                {ratingDistribution.map(({ star, count, percent }) => (
                  <div key={star} className="flex items-center gap-2.5">
                    <span className="text-[10px] tabular-nums text-muted-foreground w-3 text-right font-medium">
                      {star}
                    </span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-[6px] rounded-full bg-muted/40 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
                        className="h-full rounded-full bg-amber-400"
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground/60 w-4 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Reviews List ── */}
        <div className="px-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/50" />
            <h3 className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
              Avaliações
            </h3>
            {!loading && reviews.length > 0 && (
              <span className="text-[9px] tabular-nums text-muted-foreground/50 font-medium">
                {reviews.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-12"
            >
              <Scissors className="w-5 h-5 text-muted-foreground/15 mb-2" />
              <p className="text-[12px] text-muted-foreground/50">
                Nenhuma avaliação ainda
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              {reviews.map((review, i) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl bg-card border border-border/30 p-3.5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted/40 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-foreground/60">
                          {review.reviewer_first_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[12px] font-semibold text-foreground">
                        {review.reviewer_first_name}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(review.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex gap-0.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          "w-3 h-3",
                          star <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/20"
                        )}
                      />
                    ))}
                  </div>

                  {review.comment && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {review.comment}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarberReviews;
