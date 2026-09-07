import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Check, MapPin, X } from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
import { cn } from "@/lib/utils";

export interface PlanBenefit {
  texto: string;
  incluso: boolean;
}

export interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  limite_agendamentos_mes: number;
  tenant_id: string | null;
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
  onBack?: () => void;
}

export function PlanCarousel({
  plans,
  currentPlanIndex,
  setCurrentPlanIndex,
  onSelectPlan,
  hasActiveSubscription,
  selectedShopName,
  onChangeShop,
  onBack,
}: PlanCarouselProps) {
  // ── Embla Carousel: exatamente 1 card por vez com snap centralizado ──
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: "trimSnaps",
    loop: false,
    slidesToScroll: 1,
  });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCurrentPlanIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, setCurrentPlanIndex]);

  // Identifica o plano central em destaque (vidro escuro premium)
  const featuredIndex = useMemo(() => {
    if (plans.length === 0) return 0;
    if (plans.length === 1) return 0;
    if (plans.length === 2) return 1;
    return 1;
  }, [plans]);

  return (
    <div className="relative flex-1 flex flex-col justify-between min-h-0 overflow-hidden select-none bg-transparent">
      {/* ═══ Header Minimalista e Estratégico (Flutuante) ═══ */}
      <div 
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between pointer-events-auto">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Voltar"
                className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-md border border-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 active:scale-90 transition-transform cursor-pointer"
              >
                <BackArrow size={20} strokeWidth={2.2} />
              </button>
            ) : (
              <div className="w-10 h-10" />
            )}

            {/* Traços indicadores */}
            {plans.length > 1 && (
              <div className="flex items-center gap-1.5">
                {plans.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => emblaApi?.scrollTo(i)}
                    aria-label={`Ir para plano ${i + 1}`}
                    className={cn(
                      "h-[3.5px] rounded-full transition-all duration-300 cursor-pointer",
                      i === currentPlanIndex
                        ? "w-6 bg-[#18181B]"
                        : "w-2.5 bg-neutral-300"
                    )}
                  />
                ))}
              </div>
            )}

            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 pt-14 px-4 z-10 w-full max-w-2xl mx-auto">
        <div className="mb-2 pt-1 px-2">
          <h2 className="text-[24px] sm:text-[25px] font-semibold text-[#18181B] tracking-tight leading-none font-sans">
            Planos
          </h2>
        </div>
      </div>

      {/* ═══ Carrossel: Efeito Vidro Autêntico + Recorte Curvo nos Planos Populares ═══ */}
      <div className="flex-1 min-h-0 flex flex-col justify-center my-auto py-2">
        <div className="overflow-hidden w-full h-full flex items-center" ref={emblaRef}>
          <div className="flex w-full h-full max-h-[550px] sm:max-h-[600px] items-center">
            {plans.map((plan, idx) => {
              const isSelected = idx === currentPlanIndex;
              const isFeatured = idx === featuredIndex;

              const priceWhole = Math.floor(plan.preco_mensal);
              const priceCents = (plan.preco_mensal % 1).toFixed(2).slice(2);

              const indisponivel = !!plan.indisponivel;
              const inativo = !!plan.inativo;
              const esgotado = !!plan.esgotado;

              // Apenas os planos "Só Corte" e "Corte e Barba" / "Cabelo e Barba" recebem a curva e o Popular
              const nomeLower = (plan.nome || "").toLowerCase();
              const isPopular =
                nomeLower.includes("só corte") ||
                nomeLower.includes("so corte") ||
                nomeLower.includes("corte e barba") ||
                nomeLower.includes("cabelo e barba");

              // Parse dos benefícios reais
              const rawBenefits = Array.isArray(plan.beneficios_json)
                ? plan.beneficios_json
                : typeof plan.beneficios_json === "string"
                ? JSON.parse(plan.beneficios_json || "[]")
                : [];

              const beneficios: PlanBenefit[] = [
                {
                  texto: `${plan.limite_agendamentos_mes} agendamento${plan.limite_agendamentos_mes > 1 ? "s" : ""} no mês`,
                  incluso: true,
                },
                {
                  texto: "Horário prioritário exclusivo no app",
                  incluso: true,
                },
                ...rawBenefits.map((b: string) => ({
                  texto: b,
                  incluso: true,
                })),
              ];

              if (!isFeatured && idx === 0 && plans.length > 1) {
                beneficios.push(
                  { texto: "Combo completo cabelo + barba", incluso: false },
                  { texto: "Desconto cortesia em produtos", incluso: false }
                );
              }

              return (
                <div
                  key={plan.id}
                  className="flex-[0_0_100%] w-full min-w-0 px-8 sm:px-12 h-full max-h-[480px] sm:max-h-[540px] flex justify-center items-center"
                >
                  <div className="relative w-full max-w-[390px] h-full">
                    {/* Badge Popular: Posicionado com respiro no degrau recortado ("comeu o pedaço") */}
                    {isPopular && (
                      <div className="absolute top-2.5 right-6 z-20 flex items-center gap-1.5 pointer-events-none">
                        <span className="text-[12px] font-medium tracking-normal text-neutral-900">
                          Popular
                        </span>
                        <span className="w-2 h-2 rounded-full bg-[#16A34A] shadow-xs" />
                      </div>
                    )}

                    {/* SVG do Card: Curva recortada suave nos populares e bordas arredondadas nos demais */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 380 540"
                      preserveAspectRatio="none"
                    >
                      {isPopular ? (
                        /* Curva orgânica com degrau ("comeu um pedaço") */
                        <path
                          d="M 28 0 L 210 0 C 228 0, 238 16, 248 26 C 258 36, 268 38, 282 38 L 352 38 C 368 38, 380 50, 380 66 L 380 512 C 380 528, 368 540, 352 540 L 28 540 C 12 540, 0 528, 0 512 L 0 28 C 0 12, 12 0, 28 0 Z"
                          className={
                            isFeatured
                              ? "fill-[#141416]/85 stroke-white/20"
                              : "fill-white/80 stroke-white/80"
                          }
                          strokeWidth="1.5"
                        />
                      ) : (
                        /* Borda arredondada pura */
                        <rect
                          x="0.75"
                          y="0.75"
                          width="378.5"
                          height="538.5"
                          rx="32"
                          className={
                            isFeatured
                              ? "fill-[#141416]/85 stroke-white/20"
                              : "fill-white/80 stroke-white/80"
                          }
                          strokeWidth="1.5"
                        />
                      )}
                    </svg>

                    {/* Conteúdo interno com vidro translúcido e espaçamento confortável */}
                    <div
                      className={cn(
                        "w-full h-full p-5 sm:p-7 flex flex-col justify-between relative select-none transition-all duration-300",
                        isFeatured ? "text-white" : "text-[#18181B]",
                        indisponivel && "opacity-40 pointer-events-none"
                      )}
                    >
                      {/* Top Content: Título, Preço, Descrição com Respiro e Benefícios */}
                      <div className="relative z-10">
                        {/* Nome do Plano (com margem para não colidir com o recorte) */}
                        <div className={isPopular ? "pr-24" : "pr-4"}>
                          <h2
                            className={cn(
                              "text-[22px] sm:text-[26px] font-medium tracking-tight leading-tight",
                              isFeatured ? "text-white" : "text-[#18181B]"
                            )}
                          >
                            {plan.nome}
                          </h2>
                        </div>

                        {/* Preço em Destaque */}
                        <div className="mt-5 flex items-baseline">
                          <span
                            className={cn(
                              "text-sm font-medium mr-1",
                              isFeatured ? "text-neutral-300" : "text-neutral-500"
                            )}
                          >
                            R$
                          </span>
                          <span
                            className={cn(
                              "text-3xl sm:text-5xl font-black tracking-tight leading-none",
                              isFeatured ? "text-white" : "text-[#18181B]"
                            )}
                          >
                            {priceWhole}
                          </span>
                          <span
                            className={cn(
                              "text-xl font-medium leading-none -ml-0.5",
                              isFeatured ? "text-neutral-300" : "text-neutral-700"
                            )}
                          >
                            ,{priceCents}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-medium ml-1.5",
                              isFeatured ? "text-neutral-400" : "text-neutral-500"
                            )}
                          >
                            / mês
                          </span>
                        </div>

                        {/* Descrição com bastante respiro (afastada do preço) */}
                        <p
                          className={cn(
                            "text-[11px] sm:text-[13px] mt-3 sm:mt-5 line-clamp-2 leading-relaxed",
                            isFeatured ? "text-neutral-400" : "text-neutral-500"
                          )}
                        >
                          {plan.descricao || "Manutenção completa e atendimento personalizado para seu visual."}
                        </p>

                        {/* Divisória pontilhada fina com respiro generoso */}
                        <div
                          className={cn(
                            "w-full border-b border-dotted my-3 sm:my-5",
                            isFeatured ? "border-neutral-800" : "border-neutral-200/80"
                          )}
                        />

                        {/* Lista de benefícios com marcadores circulares elegantes */}
                        <div className="space-y-2.5 sm:space-y-3.5">
                          {beneficios.slice(0, 5).map((ben, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-2.5">
                              {ben.incluso ? (
                                <div
                                  className={cn(
                                    "w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium shadow-2xs",
                                    isFeatured
                                      ? "bg-white text-neutral-950"
                                      : "bg-neutral-900 text-white"
                                  )}
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 flex-shrink-0">
                                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                </div>
                              )}
                              <span
                                className={cn(
                                  "text-xs sm:text-[13px] font-medium leading-tight truncate",
                                  ben.incluso
                                    ? isFeatured
                                      ? "text-neutral-200"
                                      : "text-neutral-800"
                                    : isFeatured
                                    ? "text-neutral-500 line-through font-normal"
                                    : "text-neutral-400 line-through font-normal"
                                )}
                              >
                                {ben.texto}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Botão de Ação na Base em Efeito Vidro (Glassmorphism) */}
                      <div className="pt-6 mt-auto relative z-10">
                        {isFeatured ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (indisponivel || hasActiveSubscription) return;
                              onSelectPlan(plan);
                            }}
                            disabled={indisponivel || hasActiveSubscription}
                            className="w-full py-3 sm:py-4 rounded-full bg-white hover:bg-neutral-200 text-neutral-900 font-medium text-[13px] sm:text-sm active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer shadow-md"
                          >
                            {hasActiveSubscription ? "Plano Atual" : "Assinar este plano"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (indisponivel || hasActiveSubscription) return;
                              onSelectPlan(plan);
                            }}
                            disabled={indisponivel || hasActiveSubscription}
                            className="w-full py-3 sm:py-4 rounded-full bg-neutral-900 hover:bg-black text-white font-medium text-[13px] sm:text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
                          >
                            {hasActiveSubscription ? "Plano Atual" : "Assinar este plano"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spacer para a base já que o texto foi movido para o topo */}
      <div className="flex-shrink-0 pt-1 pb-3 text-center z-10" />
    </div>
  );
}