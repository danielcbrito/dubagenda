import { MapPin, Footprints, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getDiscoverUnitFullName } from "./discoverUnitUtils";

export interface BarberSummary {
  id: string;
  apelido: string;
  foto_url: string | null;
}

export interface UnitCardData {
  id: string;
  nome: string;
  brandName: string;
  brandLogo: string | null;
  brandSlug: string | null;
  bannerUrl: string | null;
  bairro: string | null;
  cidade: string | null;
  rua: string | null;
  numero: string | null;
  travelMinutes: number | null;
  travelMode: "walking" | "driving" | null;
  is_sede: boolean;
  barbers?: BarberSummary[];
  barbersCount?: number;
}

interface DiscoverUnitCardProps {
  unit: UnitCardData;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  searchQuery?: string;
}

function formatTravelTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function isShopOpenNow(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();
  // Seg-Sáb 08:00 às 20:00
  if (day === 0) return false;
  return hour >= 8 && hour < 20;
}

export function DiscoverUnitCard({
  unit,
  index,
  isSelected,
  onClick,
  searchQuery,
}: DiscoverUnitCardProps) {
  const brandInitial = unit.brandName?.[0]?.toUpperCase() ?? "?";
  const title = getDiscoverUnitFullName(unit.brandName, unit.nome);
  const address = [unit.rua, unit.numero].filter(Boolean).join(", ");
  const heroImage = unit.bannerUrl || unit.brandLogo;

  const barbers = unit.barbers || [];
  const barbersCount = unit.barbersCount ?? barbers.length;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "group w-full overflow-hidden text-left transition-all duration-200 block select-none cursor-pointer mb-6",
        "active:scale-[0.985]",
        isSelected && "ring-2 ring-foreground/20 rounded-2xl p-1"
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* ── Imagem grande (Airbnb style) ── */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[3/2] overflow-hidden rounded-2xl bg-secondary/40 mb-2.5">
        {heroImage ? (
          <img
            src={heroImage}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <span className="text-4xl font-light text-muted-foreground/30">
              {brandInitial}
            </span>
          </div>
        )}

        {/* Badge 'Preferido dos clientes' (Idêntico ao 'Preferido dos hóspedes' do Airbnb) */}
        <div className="absolute left-3.5 top-3.5 flex items-center rounded-full border border-black/5 dark:border-white/10 bg-background/95 px-3 py-1 text-[11.5px] font-medium text-foreground shadow-xs backdrop-blur-md">
          <span>Preferido dos clientes</span>
        </div>

        {/* Coração estilo Airbnb */}
        <div className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full hover:scale-110 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(0,0,0,0.35)" stroke="white" strokeWidth="2" className="drop-shadow-sm">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>

        {/* Pontinhos de Paginação (Estilo carrossel Airbnb) */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-xs" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-xs" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-xs" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-xs" />
        </div>

        {/* Logo Oficial da Barbearia no canto */}
        <div className="absolute right-3.5 bottom-3.5 h-11 w-11 rounded-full border-2 border-background bg-card shadow-[0_2px_10px_rgba(0,0,0,0.2)] overflow-hidden flex items-center justify-center z-10 transition-transform group-hover:scale-105">
          {unit.brandLogo || (unit.brandName || unit.nome || "").toLowerCase().includes("dub") ? (
            <img
              src={unit.brandLogo || "/logo-dub.png"}
              alt={unit.brandName || unit.nome}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-[14px] font-medium text-foreground">
              {brandInitial}
            </span>
          )}
        </div>
      </div>

      {/* ── Info Minimalista Estilo Airbnb com Tipografia Fina ── */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <div className="flex justify-between items-start">
          <h3 className="line-clamp-1 text-[15px] font-medium text-foreground">
            {title}
          </h3>
          {/* Estrelinha com avaliação */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-2 mt-[1px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-foreground">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span className="text-[13px] font-normal leading-none text-foreground">5,0 (12)</span>
          </div>
        </div>


        {/* Linha 2: Endereço e Tempo de Viagem */}
        <div className="flex items-center gap-1 text-[13px] font-normal text-muted-foreground/75">
          {unit.travelMinutes !== null && unit.travelMode && (
            <span className="flex items-center gap-1 text-foreground/85 font-normal">
              {unit.travelMode === "walking" ? (
                <Footprints className="h-3 w-3 inline text-foreground/70" />
              ) : (
                <Car className="h-3 w-3 inline text-foreground/70" />
              )}
              {formatTravelTime(unit.travelMinutes)}
              <span className="mx-0.5 text-muted-foreground/40">·</span>
            </span>
          )}
          {address && <span className="line-clamp-1">{address}</span>}
        </div>

        {/* Linha 3: Horários / Status com pontinho verde */}
        <div className="flex items-center gap-1.5 text-[13px] font-normal text-muted-foreground/70">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Aberto hoje</span>
          <span>·</span>
          <span>
            {barbersCount > 0
              ? `${barbersCount} ${barbersCount === 1 ? "barbeiro" : "barbeiros"} nessa barbearia`
              : "Atendimento com hora marcada"}
          </span>
        </div>

        {/* Linha 4: Preço e Link de Agendamento */}
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[13.5px] font-medium text-foreground underline underline-offset-4">
            Agendar horário
          </span>
          <span className="text-[12px] font-normal text-muted-foreground/70">
            Cortes a partir de R$ 35
          </span>
        </div>
      </div>
    </motion.button>
  );
}
