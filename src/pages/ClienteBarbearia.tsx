import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Scissors, Star, Crown, ExternalLink, Building2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  buildAddressQueryFromParts,
  geocodeAddressFromParts,
  hasPreciseAddressParts,
  normalizeLocationText,
  pickResolvedCoordinates,
  readCachedGeocode,
  resolveStoredCoordinates,
  saveCachedGeocode,
  shouldPreferGeocodedCoordinates,
} from "@/lib/geocoding";
import { Skeleton } from "@/components/ui/skeleton";
import logoDub from "@/assets/logo-dub.png";

interface BarbershopInfo {
  id: string;
  nome: string;
  slug: string | null;
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

function InfoRow({ icon: Icon, label, value, href, delay = 0 }: { icon: React.ElementType; label: string; value: string; href?: string; delay?: number }) {
  const content = (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-start gap-3 py-3.5"
    >
      <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground/60" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/40 font-semibold">{label}</p>
        <p className="text-[13px] text-foreground mt-0.5 leading-relaxed">{value}</p>
      </div>
      {href && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/30 mt-2.5 flex-shrink-0" />}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block active:bg-muted/30 transition-colors rounded-lg">
        {content}
      </a>
    );
  }

  return content;
}

export default function ClienteBarbearia() {
  const navigate = useNavigate();
  const [barbershop, setBarbershop] = useState<BarbershopInfo | null>(null);
  const [isDub, setIsDub] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvedUnitCoords, setResolvedUnitCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadBarbershop();
  }, []);

  const loadBarbershop = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }

    const { data: prof } = await supabase.from("profiles").select("barbearia_preferida_id").eq("id", user.id).single();

    if (prof?.barbearia_preferida_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, nome, slug, slogan, logo_url, telefone, whatsapp, email, site, rua, numero, bairro, cidade, estado, endereco_completo")
        .eq("id", prof.barbearia_preferida_id)
        .single();
      if (tenant) setBarbershop(tenant);
      setIsDub(false);
    } else {
      // Mesmo sem barbearia preferida, busca o tenant DUB para pegar logo dinâmica
      const { data: dubTenant } = await supabase
        .from("tenants")
        .select("id, nome, slug, slogan, logo_url, telefone, whatsapp, email, site, rua, numero, bairro, cidade, estado, endereco_completo")
        .ilike("nome", "%DUB%")
        .limit(1)
        .maybeSingle();
      if (dubTenant) setBarbershop(dubTenant);
      setIsDub(true);
    }
    setLoading(false);
  };

  // Load the correct unit's address (sede by default)
  const { data: unidadeAtual, isLoading: loadingUnidade } = useQuery({
    queryKey: ["unidade-atual-cliente", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_unidades")
        .select("id, nome, rua, numero, bairro, cidade, estado, cep, telefone, whatsapp, latitude, longitude, is_sede")
        .eq("tenant_id", barbershop!.id)
        .eq("is_sede", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
    staleTime: 5 * 60 * 1000,
  });

  const name = isDub ? (barbershop?.nome || "Barbearia DUB") : barbershop?.nome || "";
  const slogan = isDub ? (barbershop?.slogan || "Referência em corte masculino premium") : barbershop?.slogan;
  const logoUrl = barbershop?.logo_url || logoDub;

  // Address from unit data, falling back to brand-level
  const address = unidadeAtual
    ? [unidadeAtual.rua, unidadeAtual.numero, unidadeAtual.bairro, unidadeAtual.cidade, unidadeAtual.estado]
        .filter(Boolean).join(", ")
    : (barbershop?.endereco_completo ||
       [barbershop?.rua, barbershop?.numero, barbershop?.bairro, barbershop?.cidade, barbershop?.estado]
         .filter(Boolean).join(", "));

  const phone = unidadeAtual?.whatsapp || unidadeAtual?.telefone || barbershop?.whatsapp || barbershop?.telefone;

  useEffect(() => {
    const addressParts = {
      street: unidadeAtual?.rua ?? null,
      number: unidadeAtual?.numero ?? null,
      neighborhood: unidadeAtual?.bairro ?? null,
      city: unidadeAtual?.cidade ?? null,
      state: unidadeAtual?.estado ?? null,
      postalCode: unidadeAtual?.cep ?? null,
    };
    const storedCoords = resolveStoredCoordinates(
      unidadeAtual?.latitude ?? null,
      unidadeAtual?.longitude ?? null,
    );
    const addressQuery = buildAddressQueryFromParts(addressParts);
    const cachedGeocode = addressQuery
      ? readCachedGeocode(normalizeLocationText(addressQuery))
      : null;

    setResolvedUnitCoords(pickResolvedCoordinates(storedCoords, cachedGeocode));

    if (!addressQuery || !hasPreciseAddressParts(addressParts)) {
      return;
    }

    let isActive = true;

    void (async () => {
      const geocoded = await geocodeAddressFromParts(addressParts);
      if (!geocoded || !isActive) return;

      saveCachedGeocode(normalizeLocationText(addressQuery), geocoded);
      if (shouldPreferGeocodedCoordinates(storedCoords, geocoded) || !storedCoords) {
        setResolvedUnitCoords({ lat: geocoded.lat, lng: geocoded.lng });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [
    unidadeAtual?.id,
    unidadeAtual?.rua,
    unidadeAtual?.numero,
    unidadeAtual?.bairro,
    unidadeAtual?.cidade,
    unidadeAtual?.estado,
    unidadeAtual?.cep,
    unidadeAtual?.latitude,
    unidadeAtual?.longitude,
  ]);

  // Units count query for "Ver todas as unidades" row
  const { data: unidadesCount } = useQuery({
    queryKey: ["unidades-count", barbershop?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tenant_unidades")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", barbershop!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!barbershop?.id,
    staleTime: 10 * 60 * 1000,
  });

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)] h-14">
        <button
          onClick={() => navigate("/cliente/perfil")}
          className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" strokeWidth={1.8} />
        </button>
        <h1 className="text-[15px] font-semibold text-foreground">Minha Barbearia</h1>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-6">
        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border/30 bg-card p-5"
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-[72px] h-[72px] rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0",
              "border-2 shadow-sm",
              isDub ? "border-primary/30 bg-card" : "border-border/30 bg-muted/60"
            )}>
              {logoUrl ? (
                <img src={logoUrl} alt={name} className={cn("object-contain", isDub ? "w-12 h-12" : "w-full h-full object-cover")} />
              ) : (
                <Scissors className="w-7 h-7 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[17px] font-bold text-foreground">{name}</h2>
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
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className="w-3 h-3 text-primary fill-primary" />
                    ))}
                  </div>
                  <span className="text-[10px] text-primary/70 font-medium">Referência</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Info section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50 mb-2 px-1">
            Informações
          </p>
          <div className="rounded-xl border border-border/30 bg-card px-4 divide-y divide-border/20">
            {address && (
              <InfoRow
                icon={MapPin}
                label="Endereço"
                value={address}
                href={
                  resolvedUnitCoords?.lat != null && resolvedUnitCoords?.lng != null
                    ? `https://www.google.com/maps/dir/?api=1&destination=${resolvedUnitCoords.lat},${resolvedUnitCoords.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                }
                delay={0.15}
              />
            )}
            {phone && (
              <InfoRow
                icon={Phone}
                label="Contato"
                value={phone}
                href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                delay={0.2}
              />
            )}
            {barbershop?.email && (
              <InfoRow
                icon={Mail}
                label="E-mail"
                value={barbershop.email}
                href={`mailto:${barbershop.email}`}
                delay={0.25}
              />
            )}
            {barbershop?.site && (
              <InfoRow
                icon={Globe}
                label="Site"
                value={barbershop.site}
                href={barbershop.site.startsWith("http") ? barbershop.site : `https://${barbershop.site}`}
                delay={0.3}
              />
            )}
            {!address && !phone && !barbershop?.email && isDub && (
              <InfoRow icon={MapPin} label="Localização" value="Consulte nossas unidades no app" delay={0.15} />
            )}
          </div>
        </motion.div>

        {/* Ver Unidades Row */}
        {unidadesCount != null && unidadesCount >= 2 && barbershop?.slug && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <button
              onClick={() => navigate(`/b/${barbershop.slug}/unidades${unidadeAtual?.id ? `?current=${unidadeAtual.id}` : ""}`)}
              className={cn(
                "w-full flex items-center gap-3 px-4 h-14 rounded-2xl",
                "bg-card border border-border",
                "active:scale-[0.98] transition-all duration-150"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Building2 className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium text-foreground text-left">
                Ver todas as unidades
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
