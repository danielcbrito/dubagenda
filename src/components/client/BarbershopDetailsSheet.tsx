import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Phone, Mail, Globe, Scissors, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import logoDub from "@/assets/logo-dub.png";

interface BarbershopInfo {
  id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  endereco_completo: string | null;
}

interface BarbershopDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbershop: BarbershopInfo | null;
  isDub?: boolean;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold">{label}</p>
        <p className="text-[13px] text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export function BarbershopDetailsSheet({ open, onOpenChange, barbershop, isDub }: BarbershopDetailsSheetProps) {
  if (!barbershop && !isDub) return null;

  const name = isDub ? "Barbearia DUB" : barbershop?.nome || "";
  const slogan = isDub ? "Referência em corte masculino" : barbershop?.slogan;
  const logoUrl = isDub ? logoDub : barbershop?.logo_url;

  const address = barbershop?.endereco_completo ||
    [barbershop?.rua, barbershop?.numero, barbershop?.bairro, barbershop?.cidade, barbershop?.estado]
      .filter(Boolean)
      .join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="sr-only">Detalhes da Barbearia</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center overflow-hidden border border-border/30 flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <Scissors className="w-6 h-6 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-bold text-foreground">{name}</h3>
              {slogan && (
                <p className="text-[12px] text-muted-foreground mt-0.5">{slogan}</p>
              )}
              {isDub && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Referência Premium</span>
                </div>
              )}
            </div>
          </div>

          {/* Info cards */}
          <div className="rounded-xl border border-border/30 bg-secondary/20 divide-y divide-border/20 px-4">
            {address && (
              <InfoRow icon={MapPin} label="Endereço" value={address} />
            )}
            {(barbershop?.telefone || barbershop?.whatsapp) && (
              <InfoRow
                icon={Phone}
                label="Contato"
                value={barbershop?.whatsapp || barbershop?.telefone || ""}
              />
            )}
            {barbershop?.email && (
              <InfoRow icon={Mail} label="E-mail" value={barbershop.email} />
            )}
            {barbershop?.site && (
              <InfoRow icon={Globe} label="Site" value={barbershop.site} />
            )}
            {!address && !barbershop?.telefone && !barbershop?.email && isDub && (
              <InfoRow icon={MapPin} label="Localização" value="Consulte nossas unidades no app" />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}