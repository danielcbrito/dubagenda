import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
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
    slidesToScroll: 1,
  });

  const [scrollProgress, setScrollProgress] = useState<number[]>(
    plans.map((_, i) => (i === 0 ? 1 : 0))
  );

  const onScroll = useCallback(() => {
    if (!emblaApi) return;
    const scrollSnaps = emblaApi.scrollSnapList();
    const progress = emblaApi.scrollProgress();

    const scales = scrollSnaps.map((snap) => {
      const diff = Math.abs(progress - snap);
      return Math.max(0, 1 - diff * 2.8);
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

      {/* Shop selector — compact top bar */}
      <div className="flex-shrink-0 px-5 pt-1 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {selectedShopName}
            </span>
          </div>
          <button
            onClick={onChangeShop}
            className="flex items-center gap-0.5 text-primary active:opacity-70 transition-opacity flex-shrink-0"
          >
            <span style={{ fontSize: "11px", fontWeight: 600 }}>Trocar</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="flex-1 min-h-0 flex flex-col justify-center">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {plans.map((plan, idx) => {
              const progress = scrollProgress[idx] ?? 0;
              const scale = 0.85 + progress * 0.15;
              const opacity = 0.35 + progress * 0.65;
              const benefits = Array.isArray(plan.beneficios_json)
                ? plan.beneficios_json
                : [];
              const priceWhole = Math.floor(plan.preco_mensal);
              const priceCents = (plan.preco_mensal % 1)
                .toFixed(2)
                .slice(2);
              const isActive = progress > 0.7;

              return (
                <div
                  key={plan.id}
                  className="flex-[0_0_78%] min-w-0 px-1.5"
                  style={{
                    transform: `scale(${scale})`,
                    opacity,
                    transition:
                      "transform 0.18s ease-out, opacity 0.18s ease-out",
                  }}
                >
                  <div
                    className={cn(
                      "rounded-2xl p-5 h-full flex flex-col",
                      "bg-card border",
                      isActive
                        ? "border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
                        : "border-border/30"
                    )}
                  >
                    {/* Plan name — minimal */}
                    <div className="mb-1">
                      <p
                        className="text-muted-foreground uppercase"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "1.5px",
                        }}
                      >
                        Plano
                      </p>
                      <h3
                        className="text-foreground mt-1"
                        style={{
                          fontSize: "20px",
                          fontWeight: 800,
                          letterSpacing: "-0.5px",
                          lineHeight: 1.2,
                        }}
                      >
                        {plan.nome}
                      </h3>
                    </div>

                    {plan.descricao && (
                      <p
                        className="text-muted-foreground line-clamp-1"
                        style={{ fontSize: "11px", lineHeight: 1.5 }}
                      >
                        {plan.descricao}
                      </p>
                    )}

                    {/* Price block — centered, dominant */}
                    <div className="flex-1 flex flex-col items-center justify-center py-5">
                      <div className="flex items-baseline">
                        <span
                          className="text-muted-foreground self-end mb-2.5"
                          style={{ fontSize: "14px", fontWeight: 500 }}
                        >
                          R$
                        </span>
                        <span
                          className="tabular-nums leading-none text-foreground"
                          style={{
                            fontSize: "54px",
                            fontWeight: 900,
                            letterSpacing: "-3px",
                          }}
                        >
                          {priceWhole}
                        </span>
                        <div className="flex flex-col self-end mb-1 ml-0.5">
                          <span
                            className="tabular-nums leading-none text-foreground/80"
                            style={{ fontSize: "18px", fontWeight: 800 }}
                          >
                            ,{priceCents}
                          </span>
                          <span
                            className="text-muted-foreground"
                            style={{
                              fontSize: "10px",
                              fontWeight: 500,
                              marginTop: "2px",
                            }}
                          >
                            /mês
                          </span>
                        </div>
                      </div>

                      <p
                        className="text-muted-foreground mt-2 text-center"
                        style={{ fontSize: "10px", fontWeight: 500 }}
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
                    <div className="border-t border-border/40 mb-3" />

                    {/* Appointments card */}
                    <div className="flex items-center gap-3 mb-3 bg-foreground rounded-xl p-3">
                      <div
                        className="flex items-center justify-center flex-shrink-0 bg-primary rounded-[10px]"
                        style={{ width: "34px", height: "34px" }}
                      >
                        <Calendar
                          className="text-primary-foreground"
                          strokeWidth={2}
                          style={{ width: "16px", height: "16px" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-background block"
                          style={{ fontSize: "12px", fontWeight: 700 }}
                        >
                          {plan.limite_agendamentos_mes} agendamento
                          {plan.limite_agendamentos_mes > 1 ? "s" : ""}/mês
                        </span>
                        <span
                          className="text-background/50"
                          style={{ fontSize: "9px" }}
                        >
                          Horário prioritário
                        </span>
                      </div>
                    </div>

                    {/* Benefits */}
                    {benefits.length > 0 && (
                      <div>
                        {benefits.slice(0, 3).map((b: string, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2.5"
                            style={{
                              padding: "7px 0",
                              borderBottom:
                                i < Math.min(benefits.length, 3) - 1
                                  ? "1px solid hsl(var(--border) / 0.3)"
                                  : "none",
                            }}
                          >
                            <div
                              className="flex items-center justify-center flex-shrink-0 rounded-md"
                              style={{
                                width: "18px",
                                height: "18px",
                                background: "hsl(142 76% 45% / 0.08)",
                              }}
                            >
                              <Check
                                className="text-success"
                                strokeWidth={3}
                                style={{ width: "10px", height: "10px", color: "#22A855" }}
                              />
                            </div>
                            <span
                              className="text-foreground/65"
                              style={{ fontSize: "11px", fontWeight: 500 }}
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
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {plans.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === currentPlanIndex ? "16px" : "4px",
                  height: "4px",
                  background:
                    i === currentPlanIndex
                      ? "hsl(var(--foreground))"
                      : "hsl(var(--muted-foreground) / 0.2)",
                  borderRadius: "2px",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA — clean, just the button */}
      <div
        className="flex-shrink-0 border-t border-border/30 bg-background"
        style={{
          padding: "12px 20px max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div className="max-w-md mx-auto">
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
              padding: "14px",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <span>Assinar este plano</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <div className="flex items-center justify-center gap-3 mt-2.5">
            <div className="flex items-center gap-1">
              <Shield className="w-2.5 h-2.5 text-muted-foreground/30" />
              <span
                className="text-muted-foreground/30"
                style={{ fontSize: "9px", fontWeight: 500 }}
              >
                Seguro
              </span>
            </div>
            <div className="w-px h-2 bg-border/40" />
            <div className="flex items-center gap-1">
              <Check
                className="w-2.5 h-2.5 text-muted-foreground/30"
                strokeWidth={2}
              />
              <span
                className="text-muted-foreground/30"
                style={{ fontSize: "9px", fontWeight: 500 }}
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
