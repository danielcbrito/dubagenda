import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronRight, MapPin, Scissors, Star } from "lucide-react";
import { CITY_GUIDES, getCityGuide } from "@/data/cityGuides";

const BASE_URL = "https://dubagenda.lovable.app";

/** Página de guia local: SEO para "barbearias em <cidade>". */
export default function BarbershopsCityGuide() {
  const { cidade } = useParams<{ cidade?: string }>();

  // Índice: /barbearias
  if (!cidade) {
    return (
      <>
        <Helmet>
          <title>Barbearias no Brasil — Guia por cidade | DUB Agenda</title>
          <meta
            name="description"
            content="Encontre as melhores barbearias em São Paulo, Rio de Janeiro, Belo Horizonte e outras capitais. Avaliações reais, agenda em tempo real e reserva em segundos."
          />
          <link rel="canonical" href={`${BASE_URL}/barbearias`} />
          <meta property="og:title" content="Guia de barbearias no Brasil — DUB Agenda" />
          <meta property="og:url" content={`${BASE_URL}/barbearias`} />
          <meta property="og:type" content="website" />
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Início", item: BASE_URL },
                { "@type": "ListItem", position: 2, name: "Barbearias", item: `${BASE_URL}/barbearias` },
              ],
            })}
          </script>
        </Helmet>

        <main className="min-h-dvh bg-background text-foreground">
          <div className="mx-auto max-w-3xl px-5 py-10">
            <nav aria-label="Trilha" className="mb-6 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Início</Link>
              <ChevronRight className="inline w-3 h-3 mx-1" />
              <span>Barbearias</span>
            </nav>

            <h1 className="text-3xl font-bold tracking-tight mb-3">
              Barbearias no Brasil
            </h1>
            <p className="text-muted-foreground mb-8">
              Guia por cidade para encontrar as melhores barbearias perto de você. Compare avaliações,
              preços e horários — e reserve em segundos pelo DUB Agenda.
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CITY_GUIDES.map((g) => (
                <li key={g.slug}>
                  <Link
                    to={`/barbearias/${g.slug}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Barbearias em {g.city}</span>
                      <span className="text-xs text-muted-foreground">{g.stateShort}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </>
    );
  }

  const guide = getCityGuide(cidade);
  if (!guide) return <Navigate to="/barbearias" replace />;

  const url = `${BASE_URL}/barbearias/${guide.slug}`;
  const title = `Barbearias em ${guide.city} — Melhores barbeiros e preços | DUB Agenda`;
  const description = `Descubra as melhores barbearias em ${guide.city} (${guide.stateShort}). Avaliações reais, agenda em tempo real e reserva online em segundos no DUB Agenda.`;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: BASE_URL },
              { "@type": "ListItem", position: 2, name: "Barbearias", item: `${BASE_URL}/barbearias` },
              { "@type": "ListItem", position: 3, name: guide.city, item: url },
            ],
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `Melhores barbearias em ${guide.city}`,
            description,
            mainEntityOfPage: url,
            about: `Barbearias e barbeiros em ${guide.city}, ${guide.state}`,
            inLanguage: "pt-BR",
          })}
        </script>
      </Helmet>

      <main className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <nav aria-label="Trilha" className="mb-6 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Início</Link>
            <ChevronRight className="inline w-3 h-3 mx-1" />
            <Link to="/barbearias" className="hover:text-foreground">Barbearias</Link>
            <ChevronRight className="inline w-3 h-3 mx-1" />
            <span>{guide.city}</span>
          </nav>

          <header className="mb-8">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Guia local · {guide.stateShort}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Melhores barbearias em {guide.city}
            </h1>
            <p className="text-muted-foreground leading-relaxed">{guide.intro}</p>
          </header>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Scissors className="w-4 h-4" /> Por que usar o DUB Agenda em {guide.city}
            </h2>
            <ul className="space-y-2">
              {guide.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-sm text-muted-foreground">
                  <Star className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Bairros com barbearias destacadas
            </h2>
            <div className="flex flex-wrap gap-2">
              {guide.neighborhoods.map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
                >
                  {n}
                </span>
              ))}
            </div>
          </section>

          <section className="mb-10 rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold mb-2">Como encontrar um barbeiro perto de você</h2>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Crie sua conta gratuita no DUB Agenda.</li>
              <li>Escolha uma barbearia em {guide.city} pelo mapa ou pela busca.</li>
              <li>Compare profissionais, avaliações e preços.</li>
              <li>Reserve o horário e pague por Pix, dinheiro ou cartão.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/escolher-barbearia"
                className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold"
              >
                Encontrar barbearia
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold"
              >
                Criar conta grátis
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Outras cidades</h2>
            <ul className="grid grid-cols-2 gap-2">
              {CITY_GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 8).map((g) => (
                <li key={g.slug}>
                  <Link
                    to={`/barbearias/${g.slug}`}
                    className="block rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-foreground/30"
                  >
                    Barbearias em {g.city}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
