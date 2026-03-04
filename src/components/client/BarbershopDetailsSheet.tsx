import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Phone, Mail, Globe, Scissors, Star, Crown, ExternalLink } from "lucide-react";
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

function InfoRow({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground/60" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold">{label}</p>
        <p className="text-[13px] text-foreground mt-0.5 leading-relaxed">{value}</p>
      </div>
      {href && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/30 mt-2 flex-shrink-0" />}
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block active:bg-muted/30 transition-colors">
        {content}
      </a>
    );
  }

  return content;
}

export function BarbershopDetailsSheet({ open, onOpenChange, barbershop, isDub }: BarbershopDetailsSheetProps) {
  if (!barbershop && !isDub) return null;

  const name = isDub ? (barbershop?.nome || "Barbearia DUB") : barbershop?.nome || "";
  const slogan = isDub ? (barbershop?.slogan || "Referência em corte masculino premium") : barbershop?.slogan;
  const logoUrl = barbershop?.logo_url || logoDub;

  const address = barbershop?.endereco_completo ||
    [barbershop?.rua, barbershop?.numero, barbershop?.bairro, barbershop?.cidade, barbershop?.estado]
      .filter(Boolean)
      .join(", ");

  const phone = barbershop?.whatsapp || barbershop?.telefone;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-safe border-t border-border/30">
        <SheetHeader className="pb-0">
          <SheetTitle className="sr-only">Detalhes da Barbearia</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pt-2">
          {/* Hero header */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0",
              "border-2",
              isDub ? "border-primary/30 bg-card shadow-sm" : "border-border/30 bg-muted/60"
            )}>
              {logoUrl ? (
                <img src={logoUrl} alt={name} className={cn("object-contain", isDub ? "w-11 h-11" : "w-full h-full object-cover")} />
              ) : (
                <Scissors className="w-6 h-6 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-[16px] font-bold text-foreground">{name}</h3>
                {isDub && (
                  <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
                    <Crown className="w-2.5 h-2.5" />
                    Premium
                  </span>
                )}
              </div>
              {slogan && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">{slogan}</p>
              )}
              {isDub && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className="w-2.5 h-2.5 text-primary fill-primary" />
                    ))}
                  </div>
                  <span className="text-[10px] text-primary/70 font-medium">Referência</span>
                </div>
              )}
            </div>
          </div>

          {/* Info section */}
          <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 divide-y divide-border/20">
            {address && (
              <InfoRow icon={MapPin} label="Endereço" value={address} />
            )}
            {phone && (
              <InfoRow
                icon={Phone}
                label="Contato"
                value={phone}
                href={`https://wa.me/${phone.replace(/\D/g, "")}`}
              />
            )}
            {barbershop?.email && (
              <InfoRow
                icon={Mail}
                label="E-mail"
                value={barbershop.email}
                href={`mailto:${barbershop.email}`}
              />
            )}
            {barbershop?.site && (
              <InfoRow
                icon={Globe}
                label="Site"
                value={barbershop.site}
                href={barbershop.site.startsWith("http") ? barbershop.site : `https://${barbershop.site}`}
              />
            )}
            {!address && !phone && !barbershop?.email && isDub && (
              <InfoRow icon={MapPin} label="Localização" value="Consulte nossas unidades no app" />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
