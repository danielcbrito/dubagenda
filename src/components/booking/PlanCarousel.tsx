import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowRight,
  Calendar,
  Check,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  limite_agendamentos_mes: number;
  tenant_id: string | null;
}

interface PlanCarouselProps {
  plans: Plan[];
  currentPlanIndex: number;
  setCurrentPlanIndex: (i: number) => void;
  onSelectPlan: (plan: Plan) => void;
  hasActiveSubscription: boolean;
  selectedTenantId: string | null | "dub";
  selectedShopName: string;
  onChangeShop: () => void;
}

export function PlanCarousel({
  plans,
  currentPlanIndex,
  setCurrentPlanIndex,
  onSelectPlan,
  hasActiveSubscription,
  selectedShopName,
  onChangeShop,
}: PlanCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    loop: false,
  });

  const [scrollProgress, setScrollProgress] = useState<number[]>(
    plans.map((_, i) => (i === 0 ? 1 : 0))
  );

  const onScroll = useCallback(() => {
    if (!emblaApi) return;
    const engine = emblaApi.internalEngine();
    const scrollSnaps = emblaApi.scrollSnapList();
    const scrollProgress = emblaApi.scrollProgress();

    const scales = scrollSnaps.map((snap) => {
      const diff = Math.abs(scrollProgress - snap);
      return Math.max(0, 1 - diff * 2.5);
    });

    setScrollProgress(scales);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("scroll", onScroll);
    emblaApi.on("reInit", onScroll);
    emblaApi.on("select", () => {
      setCurrentPlanIndex(emblaApi.selectedScrollSnap());
    });
    onScroll();
    return () => {
      emblaApi.off("scroll", onScroll);
    };
  }, [emblaApi, onScroll, setCurrentPlanIndex]);

  const activePlan = plans[currentPlanIndex];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Carousel area */}
      <div className="flex-1 min-h-0 flex flex-col justify-center">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {plans.map((plan, idx) => {
              const progress = scrollProgress[idx] ?? 0;
              const scale = 0.82 + progress * 0.18;
              const opacity = 0.4 + progress * 0.6;
              const benefits = Array.isArray(plan.beneficios_json)
                ? plan.beneficios_json
                : [];
              const priceWhole = Math.floor(plan.preco_mensal);
              const priceCents = (plan.preco_mensal % 1)
                .toFixed(2)
                .slice(2);
              const isPopular = idx === 0 || plans.length === 1;

              return (
                <div
                  key={plan.id}
                  className="flex-[0_0_82%] min-w-0 px-2"
                  style={{
                    transform: `scale(${scale})`,
                    opacity,
                    transition: "transform 0.15s ease-out, opacity 0.15s ease-out",
                  }}
                >
                  <div
                    className={cn(
                      "rounded-2xl border p-5 h-full flex flex-col",
                      "bg-card",
                      progress > 0.7
                        ? "border-primary/30 shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
                        : "border-border/40"
                    )}
                  >
                    {/* Badge */}
                    {isPopular && (
                      <div className="mb-4">
                        <span
                          className="inline-block bg-primary text-primary-foreground rounded-md px-2.5 py-1"
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                          }}
                        >
                          Mais escolhido
                        </span>
                      </div>
                    )}

                    {/* Plan name */}
                    <h3
                      className="text-foreground"
                      style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        letterSpacing: "-0.5px",
                        lineHeight: 1.15,
                      }}
                    >
                      {plan.nome}
                    </h3>

                    {plan.descricao && (
                      <p
                        className="text-muted-foreground mt-1.5 line-clamp-2"
                        style={{ fontSize: "12px", lineHeight: 1.5 }}
                      >
                        {plan.descricao}
                      </p>
                    )}

                    {/* Price — centered block */}
                    <div className="flex-1 flex flex-col items-center justify-center py-6">
                      <div className="flex items-baseline">
                        <span
                          className="text-muted-foreground self-end mb-2"
                          style={{ fontSize: "14px", fontWeight: 500 }}
                        >
                          R$
                        </span>
                        <span
                          className="tabular-nums leading-none text-foreground"
                          style={{
                            fontSize: "58px",
                            fontWeight: 900,
                            letterSpacing: "-3px",
                          }}
                        >
                          {priceWhole}
                        </span>
                        <div className="flex flex-col self-end mb-1 ml-0.5">
                          <span
                            className="tabular-nums leading-none text-foreground/80"
                            style={{ fontSize: "20px", fontWeight: 800 }}
                          >
                            ,{priceCents}
                          </span>
                          <span
                            className="text-muted-foreground"
                            style={{
                              fontSize: "11px",
                              fontWeight: 500,
                              marginTop: "1px",
                            }}
                          >
                            /mês
                          </span>
                        </div>
                      </div>

                      <p
                        className="text-muted-foreground mt-2 text-center"
                        style={{ fontSize: "11px", fontWeight: 500 }}
                      >
                        <span className="text-primary font-semibold">
                          R${" "}
                          {(plan.preco_mensal / 30)
                            .toFixed(2)
                            .replace(".", ",")}
                          /dia
                        </span>
                        <span className="mx-1.5 text-border">·</span>
                        Sem fidelidade
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border/50 mb-4" />

                    {/* Appointments highlight */}
                    <div className="flex items-center gap-3 mb-3 border border-border/40 rounded-xl p-3">
                      <div
                        className="flex items-center justify-center flex-shrink-0 bg-primary rounded-[10px]"
                        style={{ width: "36px", height: "36px" }}
                      >
                        <Calendar
                          className="text-primary-foreground"
                          strokeWidth={2}
                          style={{ width: "18px", height: "18px" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-foreground block"
                          style={{ fontSize: "13px", fontWeight: 700 }}
                        >
                          {plan.limite_agendamentos_mes} agendamento
                          {plan.limite_agendamentos_mes > 1 ? "s" : ""}/mês
                        </span>
                        <span
                          className="text-muted-foreground"
                          style={{ fontSize: "10px" }}
                        >
                          Horário prioritário
                        </span>
                      </div>
                    </div>

                    {/* Benefits list */}
                    {benefits.length > 0 && (
                      <div className="space-y-0">
                        {benefits.slice(0, 4).map((b: string, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2.5"
                            style={{
                              padding: "8px 0",
                              borderBottom:
                                i < Math.min(benefits.length, 4) - 1
                                  ? "1px solid hsl(var(--border) / 0.3)"
                                  : "none",
                            }}
                          >
                            <div
                              className="flex items-center justify-center flex-shrink-0 rounded-md"
                              style={{
                                width: "20px",
                                height: "20px",
                                background: "hsl(142 76% 45% / 0.1)",
                              }}
                            >
                              <Check
                                className="w-3 h-3 text-success"
                                strokeWidth={3}
                              />
                            </div>
                            <span
                              className="text-foreground/75"
                              style={{ fontSize: "12px", fontWeight: 500 }}
                            >
                              {b}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dots */}
        {plans.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {plans.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === currentPlanIndex ? "18px" : "5px",
                  height: "5px",
                  background:
                    i === currentPlanIndex
                      ? "hsl(var(--primary))"
                      : "hsl(var(--muted-foreground) / 0.2)",
                  borderRadius: "3px",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div
        className="flex-shrink-0 border-t border-border/40 bg-background"
        style={{
          padding: "14px 20px max(env(safe-area-inset-bottom), 20px)",
        }}
      >
        <div className="max-w-md mx-auto">
          {/* Shop info compact */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="text-muted-foreground"
                style={{ fontSize: "11px" }}
              >
                {selectedShopName}
              </span>
            </div>
            <button
              onClick={onChangeShop}
              className="text-primary active:opacity-70 transition-opacity"
              style={{ fontSize: "11px", fontWeight: 700 }}
            >
              Trocar
            </button>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              !hasActiveSubscription &&
              activePlan &&
              onSelectPlan(activePlan)
            }
            disabled={hasActiveSubscription}
            className={cn(
              "w-full flex items-center justify-center gap-2 transition-all",
              "bg-foreground text-background active:scale-[0.97]",
              hasActiveSubscription && "opacity-50 cursor-not-allowed"
            )}
            style={{
              borderRadius: "14px",
              padding: "15px",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            <span>Assinar este plano</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-muted-foreground/40" />
              <span
                className="text-muted-foreground/40"
                style={{ fontSize: "10px", fontWeight: 500 }}
              >
                Seguro
              </span>
            </div>
            <div className="w-px h-2.5 bg-border" />
            <div className="flex items-center gap-1">
              <Check
                className="w-3 h-3 text-muted-foreground/40"
                strokeWidth={2}
              />
              <span
                className="text-muted-foreground/40"
                style={{ fontSize: "10px", fontWeight: 500 }}
              >
                Cancele quando quiser
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
