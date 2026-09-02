/** Guias de cidades — conteúdo SEO para descoberta local de barbearias. */

export interface CityGuide {
  slug: string;
  city: string;
  state: string;
  stateShort: string;
  intro: string;
  neighborhoods: string[];
  highlights: string[];
}

export const CITY_GUIDES: CityGuide[] = [
  {
    slug: "sao-paulo",
    city: "São Paulo",
    state: "São Paulo",
    stateShort: "SP",
    intro:
      "São Paulo concentra o maior ecossistema de barbearias do Brasil, com casas premiadas em bairros como Pinheiros, Vila Madalena, Jardins e Itaim. Use o DUB Agenda para comparar profissionais, ver avaliações reais e reservar seu horário em segundos.",
    neighborhoods: ["Pinheiros", "Vila Madalena", "Jardins", "Itaim Bibi", "Moema", "Tatuapé", "Mooca", "Vila Mariana"],
    highlights: [
      "Barbearias com agenda 24/7 e confirmação automática",
      "Pagamento via Pix, dinheiro ou cartão direto no app",
      "Profissionais avaliados pela comunidade DUB",
    ],
  },
  {
    slug: "rio-de-janeiro",
    city: "Rio de Janeiro",
    state: "Rio de Janeiro",
    stateShort: "RJ",
    intro:
      "Do Leblon à Barra, do Centro à Tijuca, o Rio reúne barbearias clássicas e modernas para todos os estilos. Encontre o profissional perfeito perto de você e agende sem ligar.",
    neighborhoods: ["Leblon", "Ipanema", "Copacabana", "Barra da Tijuca", "Botafogo", "Tijuca", "Centro", "Recreio"],
    highlights: [
      "Reservas instantâneas em barbearias da Zona Sul e Barra",
      "Histórico completo de cortes e fidelidade integrada",
      "Suporte humano via WhatsApp",
    ],
  },
  {
    slug: "belo-horizonte",
    city: "Belo Horizonte",
    state: "Minas Gerais",
    stateShort: "MG",
    intro:
      "BH tem barbearias autorais em bairros como Savassi, Lourdes, Funcionários e Buritis. Compare preços, veja portfólios e agende com quem combina com seu estilo.",
    neighborhoods: ["Savassi", "Lourdes", "Funcionários", "Buritis", "Pampulha", "Santa Efigênia", "Belvedere"],
    highlights: [
      "Profissionais verificados na capital mineira",
      "Filtros por serviço, avaliação e proximidade",
      "Programa de fidelidade — corte grátis a cada 3 visitas",
    ],
  },
  {
    slug: "brasilia",
    city: "Brasília",
    state: "Distrito Federal",
    stateShort: "DF",
    intro:
      "Em Brasília, as melhores barbearias estão nas asas Sul e Norte, Águas Claras e Sudoeste. Use o DUB Agenda para descobrir profissionais bem avaliados perto do seu bloco.",
    neighborhoods: ["Asa Sul", "Asa Norte", "Águas Claras", "Sudoeste", "Lago Sul", "Taguatinga", "Noroeste"],
    highlights: [
      "Agenda em tempo real para barbearias do DF",
      "Pagamento Pix com confirmação automática",
      "Avaliações verificadas por agendamento",
    ],
  },
  {
    slug: "curitiba",
    city: "Curitiba",
    state: "Paraná",
    stateShort: "PR",
    intro:
      "Curitiba oferece barbearias premium em bairros como Batel, Água Verde, Centro e Cabral. Reserve em poucos toques com profissionais avaliados pela comunidade.",
    neighborhoods: ["Batel", "Água Verde", "Centro", "Cabral", "Bigorrilho", "Mercês", "Champagnat"],
    highlights: [
      "Reservas sem ligação e sem espera",
      "Carteira digital integrada para reembolsos automáticos",
      "Lembretes via WhatsApp",
    ],
  },
  {
    slug: "porto-alegre",
    city: "Porto Alegre",
    state: "Rio Grande do Sul",
    stateShort: "RS",
    intro:
      "Em Porto Alegre, barbearias de Moinhos de Vento, Bela Vista, Petrópolis e Menino Deus se destacam pelo atendimento e pelo estilo. Encontre a sua no DUB Agenda.",
    neighborhoods: ["Moinhos de Vento", "Bela Vista", "Petrópolis", "Menino Deus", "Cidade Baixa", "Auxiliadora"],
    highlights: [
      "Comparativo de preços e tempo de atendimento",
      "Histórico de cortes salvo no perfil",
      "Cancelamento com estorno automático",
    ],
  },
  {
    slug: "salvador",
    city: "Salvador",
    state: "Bahia",
    stateShort: "BA",
    intro:
      "Salvador combina tradição e modernidade nas barbearias da Barra, Pituba, Itaigara e Rio Vermelho. Agende com profissionais que entendem do seu estilo.",
    neighborhoods: ["Barra", "Pituba", "Itaigara", "Rio Vermelho", "Caminho das Árvores", "Graça", "Ondina"],
    highlights: [
      "Profissionais avaliados em Salvador",
      "Pix, dinheiro ou cartão na hora",
      "Fidelidade — corte grátis a cada 3 atendimentos",
    ],
  },
  {
    slug: "fortaleza",
    city: "Fortaleza",
    state: "Ceará",
    stateShort: "CE",
    intro:
      "Fortaleza tem barbearias destacadas na Aldeota, Meireles, Cocó e Praia de Iracema. Descubra, compare e agende no DUB Agenda.",
    neighborhoods: ["Aldeota", "Meireles", "Cocó", "Praia de Iracema", "Varjota", "Dionísio Torres"],
    highlights: [
      "Busca por proximidade com mapa em tempo real",
      "Confirmação automática via WhatsApp",
      "Avaliações verificadas",
    ],
  },
  {
    slug: "recife",
    city: "Recife",
    state: "Pernambuco",
    stateShort: "PE",
    intro:
      "Em Recife, encontre barbearias premiadas em Boa Viagem, Casa Forte, Espinheiro e Pina. Reserve em segundos pelo DUB Agenda.",
    neighborhoods: ["Boa Viagem", "Casa Forte", "Espinheiro", "Pina", "Aflitos", "Graças", "Madalena"],
    highlights: [
      "Agenda instantânea em barbearias do Recife",
      "Carteira interna com reembolso automático",
      "Suporte por WhatsApp",
    ],
  },
];

export const getCityGuide = (slug: string) =>
  CITY_GUIDES.find((g) => g.slug === slug.toLowerCase());
