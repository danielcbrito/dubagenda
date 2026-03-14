import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";

const reviews = [
  { name: "Carlos M.", rating: 5, text: "Atendimento impecável, ambiente profissional." },
  { name: "Rafael S.", rating: 5, text: "Melhor experiência de barbearia que já tive." },
  { name: "André L.", rating: 4, text: "Praticidade e qualidade em um só lugar." },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "hsl(0 0% 100%)" }}
    >
      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+48px)] pb-32">

          {/* Brand */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color: "hsl(0 0% 45%)", fontFamily: "Nunito, sans-serif" }}
          >
            DUB AGENDA
          </motion.span>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 leading-[1.15]"
            style={{
              fontFamily: "Nunito, sans-serif",
              fontWeight: 900,
              fontSize: 32,
              color: "hsl(0 0% 8%)",
            }}
          >
            Gestão completa para
            <br />
            barbearias que levam
            <br />
            o negócio a sério.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-4"
            style={{
              fontFamily: "Nunito, sans-serif",
              fontWeight: 400,
              fontSize: 14,
              color: "hsl(0 0% 45%)",
              lineHeight: 1.6,
              maxWidth: 320,
            }}
          >
            Controle de agenda, finanças e clientes
            em uma plataforma profissional e confiável.
          </motion.p>

          {/* CTA Button */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            onClick={() => navigate("/escolher-barbearia")}
            className="mt-8 self-start inline-flex items-center gap-2"
            style={{
              fontFamily: "Nunito, sans-serif",
              fontWeight: 800,
              fontSize: 13,
              color: "hsl(0 0% 100%)",
              background: "hsl(0 72% 46%)",
              borderRadius: 10,
              padding: "12px 28px",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            Começar agora
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          {/* Divider */}
          <div
            className="mt-12 mb-8"
            style={{ height: 1, background: "hsl(0 0% 90%)" }}
          />

          {/* Reviews Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ color: "hsl(0 0% 45%)", fontFamily: "Nunito, sans-serif" }}
            >
              AVALIAÇÕES
            </span>

            <div className="mt-5 flex flex-col gap-4">
              {reviews.map((review, i) => (
                <motion.div
                  key={review.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.5 + i * 0.08 }}
                  className="p-4 rounded-xl"
                  style={{
                    background: "hsl(0 0% 97%)",
                    border: "1px solid hsl(0 0% 92%)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      style={{
                        fontFamily: "Nunito, sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "hsl(0 0% 12%)",
                      }}
                    >
                      {review.name}
                    </span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: review.rating }).map((_, j) => (
                        <Star
                          key={j}
                          className="w-3.5 h-3.5"
                          fill="hsl(43 96% 56%)"
                          stroke="hsl(43 96% 56%)"
                        />
                      ))}
                    </div>
                  </div>
                  <p
                    style={{
                      fontFamily: "Nunito, sans-serif",
                      fontWeight: 400,
                      fontSize: 12,
                      color: "hsl(0 0% 45%)",
                      lineHeight: 1.5,
                    }}
                  >
                    {review.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
