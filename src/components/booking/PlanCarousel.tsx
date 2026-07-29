import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowRight,
  Calendar,
  Check,
  Lock,
  MapPin,
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
  // Disponibilidade (opcionais — backward compatible)
  ativo?: boolean;
  controle_vagas_ativo?: boolean;
  vagas?: number | null;
  vagas_restantes?: number | null;
  esgotado?: boolean;
  inativo?: boolean;
  indisponivel?: boolean;
  servicos?: { id: string; nome: string }[];
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

      {/* Shop selector — inline pill */}
      <div className="flex-shrink-0 flex justify-center pt-1 pb-3">
        <button
          onClick={onChangeShop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card active:scale-[0.97] transition-transform"
        >
          <MapPin className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-[11px] font-medium text-foreground/80 truncate max-w-[160px]">
            {selectedShopName}
          </span>
          <span className="text-[10px] font-semibold text-primary">Trocar</span>
        </button>
      </div>

      {/* Carousel — full height, no bg separation */}
      <div className="flex-1 min-h-0 flex flex-col justify-center">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {plans.map((plan, idx) => {
              const progress = scrollProgress[idx] ?? 0;
              const scale = 0.86 + progress * 0.14;
              const opacity = 0.5 + progress * 0.5;
              const benefits = Array.isArray(plan.beneficios_json)
                ? plan.beneficios_json
                : [];
              const priceWhole = Math.floor(plan.preco_mensal);
              const priceCents = (plan.preco_mensal % 1)
                .toFixed(2)
                .slice(2);
              const isActive = progress > 0.7;
              const indisponivel = !!plan.indisponivel;
              const inativo = !!plan.inativo;
              const esgotado = !!plan.esgotado;
              const restantes = plan.vagas_restantes;
              const lowStock =
                !indisponivel &&
                plan.controle_vagas_ativo &&
                typeof restantes === "number" &&
                restantes > 0 &&
                restantes <= 3;

              return (
                <div
                  key={plan.id}
                  className="flex-[0_0_76%] min-w-0 px-1.5"
                  style={{
                    transform: `scale(${scale})`,
                    opacity,
                    transition:
                      "transform 0.18s ease-out, opacity 0.18s ease-out",
                  }}
                >
                  <div
                    className={cn(
                      "rounded-2xl p-5 h-full flex flex-col relative",
                      "border transition-opacity duration-300",
                      isActive
                        ? "bg-card border-border/60 shadow-[0_2px_16px_rgba(0,0,0,0.05)]"
                        : "bg-card/60 border-border/20",
                      indisponivel && "opacity-30 pointer-events-none"
                    )}
                  >
                    {/* Status badge — top right */}
                    {(indisponivel || lowStock) && (
                      <div className="absolute top-3 right-3 z-10">
                        {inativo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-bold uppercase tracking-wider">
                            <Lock className="w-2.5 h-2.5" />
                            Indisponível
                          </span>
                        )}
                        {!inativo && esgotado && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-bold uppercase tracking-wider">
                            Esgotado
                          </span>
                        )}
                        {lowStock && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[9px] font-bold uppercase tracking-wider">
                            Últimas {restantes} {restantes === 1 ? "vaga" : "vagas"}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Plan name */}
                    <div className="mb-1">
                      <p
                        className="text-muted-foreground/50 uppercase"
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
                        className="text-muted-foreground/60 line-clamp-1"
                        style={{ fontSize: "11px", lineHeight: 1.5 }}
                      >
                        {plan.descricao}
                      </p>
                    )}

                    {/* Price — centered */}
                    <div className="flex-1 flex flex-col items-center justify-center py-4">
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
                            className="text-muted-foreground/50"
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
                    <div className="border-t border-border/30 mb-3" />

                    {/* Appointments */}
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
                                  ? "1px solid hsl(var(--border) / 0.25)"
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
                                strokeWidth={3}
                                style={{ width: "10px", height: "10px", color: "#22A855" }}
                              />
                            </div>
                            <span
                              className="text-foreground/60"
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

      {/* Bottom CTA — no background separation, seamless */}
      <div
        className="flex-shrink-0"
        style={{
          padding: "10px 20px max(env(safe-area-inset-bottom), 14px)",
        }}
      >
        <div className="max-w-md mx-auto">
          {(() => {
            const planoIndisponivel = !!activePlan?.indisponivel;
            const disabled = hasActiveSubscription || planoIndisponivel;
            const ctaLabel = activePlan?.inativo
              ? "Plano indisponível"
              : activePlan?.esgotado
                ? "Vagas esgotadas"
                : "Assinar este plano";
            return (
              <motion.button
                whileTap={{ scale: disabled ? 1 : 0.97 }}
                onClick={() => !disabled && activePlan && onSelectPlan(activePlan)}
                disabled={disabled}
                className={cn(
                  "w-full flex items-center justify-center gap-2 transition-all",
                  "bg-foreground text-background active:scale-[0.97]",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                style={{
                  borderRadius: "14px",
                  padding: "14px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <span>{ctaLabel}</span>
                {!planoIndisponivel && <ArrowRight className="w-4 h-4" />}
              </motion.button>
            );
          })()}

          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Shield className="w-2.5 h-2.5 text-muted-foreground/25" />
              <span
                className="text-muted-foreground/25"
                style={{ fontSize: "9px", fontWeight: 500 }}
              >
                Seguro
              </span>
            </div>
            <div className="w-px h-2 bg-border/30" />
            <div className="flex items-center gap-1">
              <Check
                className="w-2.5 h-2.5 text-muted-foreground/25"
                strokeWidth={2}
              />
              <span
                className="text-muted-foreground/25"
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
