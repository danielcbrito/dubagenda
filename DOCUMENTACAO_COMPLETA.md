# 📋 DOCUMENTAÇÃO COMPLETA — DUB Agenda (App do Cliente)

> **Última atualização:** 2026-03-11
> **URL publicada:** https://dubagenda.lovable.app
> **Projeto Supabase:** `djtpzvujzmrrslirzwun`

---

## 📑 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Arquivos](#3-estrutura-de-arquivos)
4. [Sistema de Rotas](#4-sistema-de-rotas)
5. [Design System](#5-design-system)
6. [Arquitetura do Frontend](#6-arquitetura-do-frontend)
7. [Páginas — Detalhamento](#7-páginas--detalhamento)
8. [Componentes — Detalhamento](#8-componentes--detalhamento)
9. [Hooks Customizados](#9-hooks-customizados)
10. [Utilitários e Libs](#10-utilitários-e-libs)
11. [Backend — Supabase](#11-backend--supabase)
12. [Edge Functions](#12-edge-functions)
13. [Banco de Dados — Schema Completo](#13-banco-de-dados--schema-completo)
14. [Sistema de Cache](#14-sistema-de-cache)
15. [Realtime & Canais](#15-realtime--canais)
16. [Autenticação](#16-autenticação)
17. [Multi-Tenancy](#17-multi-tenancy)
18. [Fluxo de Agendamento](#18-fluxo-de-agendamento)
19. [Sistema de Fidelidade](#19-sistema-de-fidelidade)
20. [Planos e Assinaturas](#20-planos-e-assinaturas)
21. [Pagamentos](#21-pagamentos)
22. [Sistema de Manutenção](#22-sistema-de-manutenção)
23. [Tratamento de Erros](#23-tratamento-de-erros)

---

## 1. VISÃO GERAL

O **DUB Agenda** é um aplicativo mobile-first para clientes de barbearias agendarem serviços, acompanharem fidelidade, assinarem planos e gerenciarem seu perfil. Foi originalmente um app monolítico (admin + cliente) e passou por um desacoplamento em março/2026, onde toda a lógica administrativa foi removida para um app separado.

### Propósito
- Agendar cortes e serviços em barbearias parceiras
- Acompanhar programa de fidelidade (pontos → corte grátis)
- Assinar planos mensais com limites de cortes
- Pagar via PIX, cartão, dinheiro ou carteira digital
- Avaliar barbeiros após atendimentos
- Chat de suporte com IA

### Público-alvo
Clientes finais de barbearias, principalmente a **Barbearia DUB** (flagship) e barbearias parceiras que usam a plataforma multi-tenant.

---

## 2. STACK TECNOLÓGICA

| Camada | Tecnologia | Versão |
|---|---|---|
| **Framework** | React | 18.3.1 |
| **Linguagem** | TypeScript | 5.8.3 |
| **Bundler** | Vite | 5.4.19 |
| **Estilização** | Tailwind CSS | 3.4.17 |
| **Componentes UI** | shadcn/ui (Radix UI) | Vários |
| **Animações** | Framer Motion | 12.23.24 |
| **Ícones** | Lucide React | 0.462.0 |
| **Roteamento** | React Router DOM | 6.30.1 |
| **Estado Servidor** | TanStack React Query | 5.83.0 |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | 2.95.3 |
| **Autenticação** | Supabase Auth | — |
| **Tema** | next-themes | 0.3.0 |
| **Formulários** | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| **Datas** | date-fns | 3.6.0 |
| **Toasts** | Sonner | 1.7.4 |
| **Fontes** | DM Sans (corpo) + Space Grotesk (display) | — |

---

## 3. ESTRUTURA DE ARQUIVOS

```
src/
├── App.tsx                          # Componente raiz: providers, rotas, guards
├── main.tsx                         # Entry point
├── index.css                        # Design tokens (CSS variables), temas dark/light
├── App.css                          # Estilos globais auxiliares
│
├── assets/                          # Imagens estáticas (logos, backgrounds, ícones)
│   ├── logo-dub.png                 # Logo da Barbearia DUB
│   ├── pix-icon.png                 # Ícone PIX
│   ├── whatsapp-logo.png            # Logo WhatsApp
│   ├── google-maps-icon.png         # Ícone Google Maps
│   ├── landing-*.jpg                # Imagens da landing page
│   ├── barbershop-*.jpg             # Backgrounds premium
│   └── scissors-decorative.png      # Decorativo
│
├── pages/                           # Páginas (1 por rota)
│   ├── Index.tsx                    # Landing page (/)
│   ├── Auth.tsx                     # Login/Cadastro (/auth)
│   ├── AuthCallback.tsx             # Callback OAuth (/auth/callback)
│   ├── EmailVerification.tsx        # Verificação de email
│   ├── VerificarWhatsApp.tsx        # Verificação via WhatsApp
│   ├── EscolherVerificacao.tsx      # Escolha do método de verificação
│   ├── ForgotPassword.tsx           # Esqueci minha senha
│   ├── ResetPassword.tsx            # Redefinir senha
│   ├── EscolherBarbearia.tsx        # Catálogo de barbearias
│   ├── BarbershopPublic.tsx         # Página pública de barbearia (/:slug ou /b/:slug)
│   ├── Cliente.tsx                  # ⭐ Dashboard principal do cliente (/cliente)
│   ├── ClienteAgendar.tsx           # Fluxo de agendamento (/cliente/agendar)
│   ├── ClienteAssinar.tsx           # Assinatura de planos (/cliente/assinar)
│   ├── ClientePagamento.tsx         # Pagamento (/cliente/pagamento)
│   ├── ClientePixCheckout.tsx       # Checkout PIX (/cliente/pix-checkout)
│   ├── SubscriptionPixCheckout.tsx  # Checkout PIX para assinatura
│   ├── ClienteCarteira.tsx          # Carteira digital (/cliente/carteira)
│   ├── ClientePerfil.tsx            # Tela de perfil (/cliente/perfil)
│   ├── ClienteDadosPessoais.tsx     # Dados pessoais (/cliente/dados-pessoais)
│   ├── ClienteSeguranca.tsx         # Segurança (/cliente/seguranca)
│   ├── ClienteBarbearia.tsx         # Minha barbearia (/cliente/barbearia)
│   ├── BarberReviews.tsx            # Avaliações de barbeiro
│   ├── SupportChat.tsx              # Chat de suporte (/suporte)
│   └── NotFound.tsx                 # 404
│
├── components/
│   ├── ui/                          # shadcn/ui (Radix wrappers) — ~40 componentes
│   │   ├── button.tsx, card.tsx, dialog.tsx, sheet.tsx, toast.tsx...
│   │   └── back-arrow.tsx           # Seta de navegação customizada
│   │
│   ├── booking/                     # Componentes do fluxo de agendamento
│   │   ├── BarberCard.tsx           # Card de seleção de barbeiro
│   │   ├── ServiceCard.tsx          # Card de seleção de serviço
│   │   ├── TimeSlot.tsx             # Slot de horário
│   │   ├── TimeSelectionBar.tsx     # Barra de seleção de horário
│   │   ├── PremiumCalendar.tsx      # Calendário premium
│   │   ├── PaymentOption.tsx        # Opção de pagamento
│   │   ├── SummaryRow.tsx           # Linha do resumo do agendamento
│   │   ├── BookingBottomBar.tsx     # Barra inferior do booking
│   │   ├── FloatingActionBar.tsx    # FAB do booking
│   │   ├── StepDots.tsx             # Indicador de etapas (dots)
│   │   ├── StepIndicator.tsx        # Indicador de etapas (texto)
│   │   └── UnitSelector.tsx         # Seletor de unidade
│   │
│   ├── client/                      # Componentes do dashboard do cliente
│   │   ├── ClientHeader.tsx         # Header com nome e avatar
│   │   ├── LoyaltyCard.tsx          # Card de fidelidade (pontos/progresso)
│   │   ├── PlanTrackerCard.tsx      # Card de acompanhamento do plano
│   │   ├── ScheduleButton.tsx       # Botão "Agendar Horário"
│   │   ├── AppointmentCardPremium.tsx # Card de agendamento
│   │   ├── BarberReviewModal.tsx    # Modal de avaliação do barbeiro
│   │   ├── PendingReviewBanner.tsx  # Banner de avaliação pendente
│   │   ├── PendingSubscriptionBanner.tsx # Banner de assinatura pendente
│   │   ├── PlanExpiredBanner.tsx     # Banner de plano expirado
│   │   ├── NotificationBellPremium.tsx # Sino de notificações
│   │   ├── BottomNavItem.tsx        # Item da nav inferior
│   │   ├── StoreComingSoonDialog.tsx # Dialog "Loja em breve"
│   │   └── BarbershopDetailsSheet.tsx # Sheet de detalhes da barbearia
│   │
│   ├── discover/                    # Componentes de descoberta
│   │   ├── BarberProfileSheet.tsx   # Sheet do perfil do barbeiro
│   │   └── BarbershopDetailSheet.tsx # Sheet de detalhes da barbearia
│   │
│   ├── portfolio/                   # Portfólio do barbeiro
│   │   └── PortfolioGallery.tsx     # Galeria de fotos
│   │
│   ├── support/                     # Chat de suporte
│   │   ├── SupportChatBubble.tsx    # Botão flutuante de suporte
│   │   ├── SupportChatInterface.tsx # Interface do chat
│   │   ├── BotAvatar.tsx            # Avatar do bot
│   │   └── chatMessageUtils.ts      # Utilitários de mensagem
│   │
│   ├── BottomNavigation.tsx         # Navegação inferior (Início/Loja/Planos/Perfil)
│   ├── SplashScreen.tsx             # Tela de splash (2s)
│   ├── AnnouncementDialog.tsx       # Dialog de anúncios
│   ├── AnnouncementModal.tsx        # Modal de anúncios
│   ├── AppointmentHistorySheet.tsx  # Histórico de agendamentos
│   ├── CancelAppointmentModal.tsx   # Modal de cancelamento
│   ├── CancelledAppointmentBanner.tsx # Banner de cancelamento
│   ├── GlobalErrorBoundary.tsx      # Error boundary global
│   ├── InstabilityScreen.tsx        # Tela de instabilidade
│   ├── MaintenanceScreen.tsx        # Tela de manutenção
│   ├── MaintenanceWarningBanner.tsx # Banner de aviso de manutenção
│   ├── MyPlansSheet.tsx             # Sheet "Meus Planos"
│   ├── MyProfileSheet.tsx           # Sheet "Meu Perfil"
│   ├── NotificationsSheet.tsx       # Sheet de notificações
│   ├── PendingPaymentCard.tsx       # Card de pagamento pendente
│   ├── PointsDetailModal.tsx        # Modal de detalhes dos pontos
│   ├── RescheduleAppointmentModal.tsx # Modal de remarcação
│   ├── SubscribePlanSheet.tsx       # Sheet de assinatura de plano
│   └── WalletSheet.tsx              # Sheet da carteira
│
├── hooks/                           # Hooks customizados
│   ├── useMaintenanceMode.ts        # Estado de manutenção
│   ├── useDataError.ts              # Tratamento de erros de dados
│   ├── useBarberBusinessHours.ts    # Horários do barbeiro
│   ├── useBarberRatings.ts          # Avaliações do barbeiro
│   ├── useSlotAvailability.ts       # Disponibilidade de horários
│   ├── usePendingReviews.ts         # Avaliações pendentes
│   ├── useNotificationManager.ts    # Gerenciador de notificações
│   ├── useDeviceFingerprint.ts      # Fingerprint do dispositivo
│   ├── useInterval.ts               # setInterval com cleanup
│   ├── use-mobile.tsx               # Detecção de mobile
│   └── use-toast.ts                 # Hook do toast
│
├── utils/
│   ├── cache.ts                     # Sistema de cache (sessionStorage + TTL)
│   └── tenantQuery.ts               # Filtros de multi-tenancy
│
├── lib/
│   ├── utils.ts                     # cn() = clsx + tailwind-merge
│   ├── validators.ts                # Validadores (CPF, telefone, etc.)
│   └── webhookService.ts            # Disparo de webhooks
│
└── integrations/supabase/
    ├── client.ts                    # Instância do Supabase client
    └── types.ts                     # Tipos gerados automaticamente (read-only)

supabase/
├── config.toml                      # Configuração de Edge Functions
└── functions/                       # ~30 Edge Functions (Deno)
    ├── atomic-booking/              # Reserva atômica
    ├── check-availability/          # Verificação de disponibilidade
    ├── create-asaas-pix/            # Criação de cobrança PIX
    ├── create-asaas-customer/       # Criação de cliente Asaas
    ├── create-asaas-card/           # Pagamento por cartão
    ├── create-subscription-pix/     # Assinatura via PIX
    ├── create-subscription-card/    # Assinatura via cartão
    ├── check-subscription-pix/      # Verificar pagamento PIX de assinatura
    ├── cancel-subscription/         # Cancelar assinatura
    ├── asaas-webhook/               # Webhook do gateway Asaas
    ├── ai-support-chat/             # Chat de suporte com IA
    ├── appointment-reminders/       # Lembretes automáticos
    ├── wallet-operations/           # Operações de carteira
    ├── wallet-pin/                  # PIN da carteira
    ├── whatsapp-verification/       # Verificação via WhatsApp
    ├── send-confirmation-email/     # Email de confirmação
    ├── send-webhook-event/          # Disparo de webhook
    ├── refund-payment/              # Reembolso
    ├── cleanup-pending-payments/    # Limpeza de pagamentos expirados
    ├── validate-appointment/        # Validação de agendamento
    ├── health-check/                # Health check
    ├── manage-clients/              # Gestão de clientes
    ├── admin-reset-password/        # Reset de senha (admin)
    ├── check-duplicate-signup/      # Verificar cadastro duplicado
    ├── create-checkout/             # Criar checkout Stripe
    ├── verify-stripe-session/       # Verificar sessão Stripe
    ├── check-subscription/          # Verificar assinatura Stripe
    ├── customer-portal/             # Portal do cliente Stripe
    ├── create-payment/              # Criar pagamento genérico
    ├── execute-scheduled-dispatches/ # Execução de disparos programados
    ├── generate-monthly-report/     # Relatório mensal
    ├── generate-promotion-ai/       # Promoção com IA
    ├── google-calendar-sync/        # Sincronização Google Calendar
    └── speech-to-text/              # Conversão de áudio para texto
```

---

## 4. SISTEMA DE ROTAS

### Arquivo: `src/App.tsx`

Todas as rotas são lazy-loaded via `React.lazy()` com fallback `<PageLoader />` (spinner centralizado).

| Rota | Componente | Acesso | Descrição |
|---|---|---|---|
| `/` | `Index` | Público | Landing page com CTAs |
| `/auth` | `Auth` | Público | Login e cadastro |
| `/auth/callback` | `AuthCallback` | Público | Callback OAuth (Google, etc.) |
| `/verificar-email` | `EmailVerification` | Público | Verificação de email |
| `/verificar-whatsapp` | `VerificarWhatsApp` | Público | Verificação via WhatsApp |
| `/escolher-verificacao` | `EscolherVerificacao` | Público | Escolha do método de verificação |
| `/esqueci-senha` | `ForgotPassword` | Público | Recuperação de senha |
| `/resetar-senha` | `ResetPassword` | Público | Redefinição de senha |
| `/escolher-barbearia` | `EscolherBarbearia` | Público | Catálogo de barbearias |
| `/b/:slug` | `BarbershopPublic` | Público | Página pública de barbearia (prefixo /b/) |
| `/:slug` | `BarbershopPublic` | Público | Página pública de barbearia (slug direto) |
| `/cliente` | `Cliente` | Autenticado | ⭐ Dashboard principal |
| `/cliente/agendar` | `ClienteAgendar` | Autenticado | Fluxo de agendamento (7 etapas) |
| `/cliente/assinar` | `ClienteAssinar` | Autenticado | Assinatura de planos |
| `/cliente/pagamento` | `ClientePagamento` | Autenticado | Pagamento de agendamento |
| `/cliente/pix-checkout` | `ClientePixCheckout` | Autenticado | Checkout PIX (QR Code) |
| `/cliente/assinatura-pix` | `SubscriptionPixCheckout` | Autenticado | Checkout PIX de assinatura |
| `/cliente/carteira` | `ClienteCarteira` | Autenticado | Carteira digital |
| `/cliente/perfil` | `ClientePerfil` | Autenticado | Perfil do usuário |
| `/cliente/dados-pessoais` | `ClienteDadosPessoais` | Autenticado | Edição de dados pessoais |
| `/cliente/seguranca` | `ClienteSeguranca` | Autenticado | Segurança da conta |
| `/cliente/barbearia` | `ClienteBarbearia` | Autenticado | Minha barbearia |
| `/cliente/barbeiro/:barberId/avaliacoes` | `BarberReviews` | Autenticado | Avaliações de um barbeiro |
| `/suporte` | `SupportChat` | Autenticado | Chat de suporte com IA |
| `*` | `NotFound` | Público | Página 404 |

### Guards e Wrappers

1. **`AuthSessionGuard`** — Limpa sessões inválidas automaticamente. Se o token expirar, faz signOut e redireciona para `/auth`.
2. **`MaintenanceWrapper`** — Verifica estado de manutenção. Se ativa, mostra `MaintenanceScreen` para usuários não-permitidos. Rotas públicas são sempre acessíveis.
3. **`ScrollLockGuard`** — Limpa estilos residuais de scroll lock (modais, sheets) a cada troca de rota.
4. **`ThemeColorSync`** — Sincroniza `<meta name="theme-color">` com o tema (dark: `#0D0D0D`, light: `#F5F5F5`).
5. **`SplashScreen`** — Exibido por 2 segundos no boot do app.

### Rotas Públicas (sempre acessíveis)
```typescript
const PUBLIC_ROUTES = [
  '/', '/auth', '/auth/callback', '/verificar-email',
  '/verificar-whatsapp', '/escolher-verificacao',
  '/esqueci-senha', '/resetar-senha', '/escolher-barbearia'
];
```
Adicionalmente, qualquer rota com prefixo `/b/` ou slug direto de barbearia é pública.

---

## 5. DESIGN SYSTEM

### Filosofia: "Dark Premium"

O app usa uma estética premium de alto contraste, com fundo preto puro (#000000) no dark mode e branco puro (#FFFFFF) no light mode. Não usa gradientes roxos genéricos nem fontes como Inter/Poppins.

### Tokens de Cor (index.css)

**Dark Mode (padrão):**
| Token | HSL | Hex | Uso |
|---|---|---|---|
| `--background` | `0 0% 0%` | #000000 | Fundo principal |
| `--foreground` | `0 0% 100%` | #FFFFFF | Texto principal |
| `--card` | `0 0% 7%` | #111111 | Fundo de cards |
| `--card-elevated` | `0 0% 10%` | #1A1A1A | Cards elevados |
| `--primary` | `0 78% 57%` | Vermelho | Cor de destaque principal |
| `--primary-glow` | `0 78% 67%` | Vermelho claro | Glow do primary |
| `--secondary` | `0 0% 14%` | Cinza escuro | Elementos secundários |
| `--muted` | `0 0% 16%` | Cinza | Elementos discretos |
| `--muted-foreground` | `0 0% 70%` | #B3B3B3 | Texto secundário |
| `--gold` | `40 65% 55%` | Dourado | Planos premium |
| `--border` | `0 0% 15%` | #262626 | Bordas |
| `--destructive` | `0 84% 60%` | Vermelho forte | Ações destrutivas |
| `--success` | `142 76% 45%` | Verde | Sucesso |

**Light Mode:**
| Token | HSL | Hex |
|---|---|---|
| `--background` | `0 0% 100%` | #FFFFFF |
| `--foreground` | `0 0% 0%` | #000000 |
| `--card` | `0 0% 100%` | #FFFFFF |
| `--primary` | `0 78% 47%` | Vermelho mais escuro |
| `--muted-foreground` | `0 0% 35%` | Cinza escuro |
| `--border` | `0 0% 88%` | Cinza claro |

### Gradientes Customizados
```css
--gradient-primary: linear-gradient(135deg, hsl(0 78% 55%), hsl(0 78% 45%));
--gradient-gold: linear-gradient(135deg, hsl(40 65% 55%), hsl(40 65% 45%));
--gradient-titanium: linear-gradient(180deg, hsl(0 0% 10%), hsl(0 0% 6%));
--gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
```

### Sombras Premium
```css
--shadow-premium: 0 10px 40px -10px rgba(0,0,0,0.6), 0 4px 20px rgba(0,0,0,0.3);
--shadow-glow-red: 0 0 40px rgba(219,59,59,0.2), 0 0 80px rgba(219,59,59,0.08);
--shadow-glow-gold: 0 0 30px rgba(209,168,84,0.2), 0 0 60px rgba(209,168,84,0.1);
--shadow-card: 0 8px 32px rgba(0,0,0,0.4);
```

### Tipografia
- **Corpo:** `DM Sans` — clean e legível
- **Display:** `Space Grotesk` — títulos e logotipo
- Labels em `CAIXA ALTA` com `tracking-widest`, tamanho `8-10px`
- KPIs com `tabular-nums` para alinhamento numérico

### Tailwind Config (tailwind.config.ts)
- Todas as cores mapeadas como tokens semânticos
- `darkMode: ["class"]` — tema controlado por classe
- Cores estendidas: `primary.glow`, `card.elevated`, `gold`, `success`
- Sombras customizadas: `premium`, `glow-red`, `glow-gold`, `elegant`
- Background images: `gradient-primary`, `gradient-gold`, etc.
- Bordas: `--radius: 0.875rem` (14px)

### Regras de Uso
```tsx
// ✅ CORRETO — sempre tokens semânticos
className="bg-background text-foreground"
className="bg-card text-card-foreground"
className="text-muted-foreground border-border"

// ❌ ERRADO — nunca cores diretas
className="bg-white text-black bg-gray-500"
```

---

## 6. ARQUITETURA DO FRONTEND

### Providers (App.tsx)
```
GlobalErrorBoundary
  └─ ThemeProvider (next-themes, defaultTheme="light")
       ├─ ThemeColorSync
       └─ QueryClientProvider (TanStack Query)
            └─ TooltipProvider
                 ├─ Toaster (shadcn)
                 ├─ Sonner (toast)
                 └─ AppWithSplash
                      ├─ SplashScreen (2s)
                      └─ BrowserRouter
                           └─ AppRoutes
                                └─ AuthSessionGuard
                                     ├─ ScrollLockGuard
                                     └─ MaintenanceWrapper
                                          ├─ Suspense → Routes
                                          └─ SupportChatBubble
```

### Carregamento de Dados (Cliente.tsx)

O dashboard principal usa um sistema de carregamento em **4 camadas independentes**:

```
checkAuth()
  │
  ├─ 1. loadProfileData(userId) ─── Sequencial (precisa do tenantId)
  │       → profile, preferredShop
  │       → Cache: cache_profile_{userId} (60min)
  │
  └─ Promise.all([                 ─── Paralelo
       ├─ 2. loadAppointmentsData(userId)
       │       → appointments, payments, pendingBookings, recentCancellations
       │       → Cache: cache_appointments_{userId} (5min)
       │
       ├─ 3. loadLoyaltyData(userId, tenantId)
       │       → points, credits, redemptions, subscriptions
       │       → Cache: cache_loyalty_{userId} (5min)
       │
       └─ 4. loadShopData(tenantId)
               → shopBarbers (com avaliações)
               → Cache: cache_shop_{tenantId} (30min)
     ])
```

Cada camada tem:
- **Loading flag independente** (`profileLoading`, `appointmentsLoading`, etc.)
- **Race-condition guard** (`profileLoadRef`, etc.) — impede chamadas duplicadas
- **Cache de sessionStorage** com TTL
- **Renderização progressiva** — cada bloco aparece quando sua camada termina

### Estado Global
O app **não usa** estado global (Redux, Zustand, Context). Todo estado é local ao componente `Cliente.tsx` e passado via props para subcomponentes. Cache via `sessionStorage`.

---

## 7. PÁGINAS — DETALHAMENTO

### 7.1. `/` — Index (Landing Page)
**Arquivo:** `src/pages/Index.tsx` (143 linhas)

Tela de entrada do app. Apresenta dois CTAs:
- **"Seja Cliente Exclusivo DUB"** → navega para `/auth`
- **"Encontrar Barbearias"** → navega para `/escolher-barbearia`

Design: imagem hero com fade gradiente, logo animado "DUB Agenda", CTAs com feedback tátil.

### 7.2. `/auth` — Login/Cadastro
**Arquivo:** `src/pages/Auth.tsx` (603 linhas)

Suporta dois modos via query param `?mode=login|signup`:

**Cadastro (`signup`):**
- Campos: nome, email, telefone, CPF, senha
- Validação com Zod (schema `signupSchema`)
- Formatação automática de telefone e CPF
- Verifica duplicatas via Edge Function `check-duplicate-signup`
- Após cadastro, redireciona para verificação (email ou WhatsApp)
- Param `origin`: `dub_exclusive` (padrão) ou slug de barbearia parceira

**Login:**
- Campos: email, senha
- Após login, verifica role do usuário e redireciona:
  - `cliente` → `/cliente`
  - `admin` ou `tenant_admin` → redireciona para app externo do barbeiro

### 7.3. `/cliente` — Dashboard Principal
**Arquivo:** `src/pages/Cliente.tsx` (1194 linhas) ⭐ **MAIOR ARQUIVO DO APP**

Layout mobile-first com `height: calc(100dvh - 56px)` (desconta nav inferior).

**Blocos visíveis (de cima para baixo):**
1. **ClientHeader** — Nome do cliente, avatar, indicador Realtime
2. **Barbershop Card** — Nome da barbearia preferida + botão "Trocar"
3. **Loyalty/Plan Card** — Depende do estado:
   - Se tem plano ativo → `PlanTrackerCard` (progresso de uso)
   - Se tem assinatura pendente → `PendingSubscriptionBanner`
   - Se tem plano expirado → `PlanExpiredBanner` + `LoyaltyCard`
   - Se não tem plano → `LoyaltyCard` (pontos de fidelidade)
4. **ScheduleButton** — Botão principal "Agendar Horário"
5. **PendingPaymentCards** — Reservas aguardando pagamento PIX
6. **PendingReviewBanners** — Avaliações pendentes de barbeiros
7. **AppointmentCards** — Agendamentos ativos (pending/confirmed)
8. **Estado vazio** — Mensagem quando não há agendamentos

**Sheets/Modais (sobrepostos):**
- `MyPlansSheet` — Ver/gerenciar planos
- `SubscribePlanSheet` — Assinar novo plano
- `MyProfileSheet` — Perfil resumido
- `WalletSheet` — Carteira digital
- `AppointmentHistorySheet` — Histórico completo
- `PointsDetailModal` — Detalhes dos pontos
- `BarberReviewModal` — Avaliar barbeiro
- `AnnouncementDialog` / `AnnouncementModal` — Anúncios

**Canais Realtime (3):**
1. `canal-agendamentos` — Mudanças em `agendamentos` e `pending_bookings` do usuário
2. `canal-fidelidade` — Mudanças em `assinaturas`, `pontos`, `resgates`, `promocoes`, `planos`
3. `canal-barbeiros` — Mudanças em `barbeiros` do tenant (se tenantId disponível)

### 7.4. `/cliente/agendar` — Fluxo de Agendamento
**Arquivo:** `src/pages/ClienteAgendar.tsx` (2683 linhas) ⭐ **SEGUNDO MAIOR ARQUIVO**

Fluxo wizard de 7 etapas:
1. **Selecionar Unidade** (se disponível) — `UnitSelector`
2. **Selecionar Barbeiro** — `BarberCard` com avaliações
3. **Selecionar Serviço(s)** — `ServiceCard` com multi-seleção
4. **Selecionar Data** — `PremiumCalendar` (carrossel horizontal)
5. **Selecionar Horário** — `TimeSlot` via `TimeSelectionBar`
6. **Selecionar Pagamento** — `PaymentOption` (dinheiro, cartão, PIX, carteira, plano)
7. **Confirmar** — `SummaryRow` com resumo completo

A confirmação final chama a Edge Function `atomic-booking` que:
- Verifica conflitos atomicamente
- Cria o agendamento
- Processa pagamento se necessário
- Consome uso de plano ou resgate

### 7.5. `/cliente/perfil` — Perfil
**Arquivo:** `src/pages/ClientePerfil.tsx` (443 linhas)

Organizado em seções:
- **Minha Conta** — Dados pessoais, Segurança
- **Serviços** — Minha Barbearia, Carteira, Histórico, Fidelidade
- **Preferências** — Notificações, Tema (dark/light toggle)
- **Suporte** — Central de ajuda
- **Sair** — Logout com confirmação

### 7.6. `/escolher-barbearia` — Catálogo de Barbearias
**Arquivo:** `src/pages/EscolherBarbearia.tsx` (525 linhas)

Lista todas as barbearias cadastradas (`tenants`) com:
- Busca por nome
- Ordenação por distância (geolocalização)
- Card com logo, nome, bairro, avaliação média
- Barbearia DUB sempre destacada como flagship

### 7.7. `/:slug` ou `/b/:slug` — Página Pública da Barbearia
**Arquivo:** `src/pages/BarbershopPublic.tsx` (790 linhas)

Página pública acessível sem login:
- Header com logo, nome, slogan
- Endereço com link para Google Maps
- Lista de barbeiros com fotos e avaliações
- Portfólio de fotos
- Botão "Agendar" → redireciona para login se não autenticado
- Botão "Trocar para esta barbearia" → se logado em outra
- Suporte a coordenadas GPS e cálculo de distância (Haversine)

---

## 8. COMPONENTES — DETALHAMENTO

### 8.1. BottomNavigation
**Arquivo:** `src/components/BottomNavigation.tsx`

Navegação fixa inferior com 4 itens:
| Ícone | Label | Ação |
|---|---|---|
| `Home` | Início | `navigate("/cliente")` |
| `ShoppingBag` | Loja | Abre `StoreComingSoonDialog` |
| `Crown` | Planos | `onPlansClick()` (abre sheet) |
| `User` | Perfil | `navigate("/cliente/perfil")` |

Usa `env(safe-area-inset-bottom)` para iPhones com notch.

### 8.2. SupportChatBubble
**Arquivo:** `src/components/support/SupportChatBubble.tsx`

Botão flutuante "Suporte" com ícone de headphones e dot verde (online). Visível apenas em `/cliente` e `/cliente/perfil`. Posicionado acima da BottomNavigation.

### 8.3. LoyaltyCard
**Arquivo:** `src/components/client/LoyaltyCard.tsx`

Card de fidelidade que exibe:
- Progresso visual com círculos (preenchidos = pontos acumulados)
- Texto "Faltam X cortes para 1 grátis"
- Barra de progresso percentual
- Total de resgates realizados

### 8.4. SplashScreen
**Arquivo:** `src/components/SplashScreen.tsx`

Tela de splash exibida por 2 segundos no boot:
- Logo "DUB Agenda" com animação de entrada
- Linha decorativa animada
- Tagline "Seu estilo, na palma da mão"
- Fade out com `AnimatePresence`

---

## 9. HOOKS CUSTOMIZADOS

### `useMaintenanceMode`
**Arquivo:** `src/hooks/useMaintenanceMode.ts` (264 linhas)

Verifica se o app está em modo manutenção:
- Lê `webhook_config` diretamente (prioridade) ou via RPC `get_maintenance_status` (fallback)
- Verifica se o email do usuário está na lista de permitidos (`manutencao_emails_permitidos`)
- Suporta manutenção agendada (`inicio_programada` / `fim_programada`)
- Suporta aviso prévio (`manutencao_aviso_ativo` + `manutencao_aviso_mensagem`)
- Sincroniza via Realtime + polling de segurança

### `useDataError`
**Arquivo:** `src/hooks/useDataError.ts` (72 linhas)

Gerencia erros de carregamento de dados por camada:
- Filtra falsos positivos (mensagens como "no rows found", "failed to fetch", etc.)
- Ignora erros nos primeiros 4 segundos após mount (erros transitórios de startup)
- Deduplica erros por camada
- Expõe: `hasError`, `errors[]`, `reportError()`, `clearErrors()`

### `useSlotAvailability`
Verifica disponibilidade de horários para agendamento via Edge Function `check-availability`.

### `useBarberRatings`
Busca avaliações médias dos barbeiros da tabela `barbeiro_avaliacoes`.

### `useBarberBusinessHours`
Busca horários de funcionamento personalizados do barbeiro (`configuracoes_horario_barbeiro`) com fallback para horários globais (`configuracoes_horario`).

### `usePendingReviews`
Identifica agendamentos concluídos que ainda não foram avaliados pelo cliente.

### `useNotificationManager`
Gerencia notificações push e som para o usuário logado.

### `useDeviceFingerprint`
Gera um fingerprint único do dispositivo para verificação de segurança.

### `useInterval`
Wrapper para `setInterval` com limpeza automática no unmount.

---

## 10. UTILITÁRIOS E LIBS

### `src/utils/cache.ts`
```typescript
setCache(key: string, data: unknown, ttlMinutes: number) // Salva com expiração
getCache<T>(key: string): T | null                        // Lê com verificação de TTL
```
Usa `sessionStorage` (não persiste entre abas). TTL em minutos. Remove automaticamente dados expirados.

### `src/utils/tenantQuery.ts`
```typescript
buildBarberQuery(tenantId, unidadeId?)  // Query de barbeiros filtrada por tenant
applyTenantFilter(query, tenantId)      // Aplica filtro de tenant em query existente
```
Centraliza o tratamento legado onde `tenant_id IS NULL` = Barbearia DUB (global).

### `src/lib/utils.ts`
```typescript
cn(...inputs) // clsx + tailwind-merge
```

### `src/lib/validators.ts`
- `formatPhone(value)` — Formata telefone brasileiro
- `validatePhone(value)` — Valida telefone
- `formatCPF(value)` — Formata CPF (XXX.XXX.XXX-XX)
- `validateCPF(value)` — Valida CPF com dígitos verificadores

### `src/lib/webhookService.ts`
Envia eventos para o webhook configurado (confirmações, remarcações, etc.).

---

## 11. BACKEND — SUPABASE

### Configuração
- **Projeto:** `djtpzvujzmrrslirzwun`
- **URL:** `https://djtpzvujzmrrslirzwun.supabase.co`
- **Client:** `src/integrations/supabase/client.ts`
- Auth com `localStorage`, `persistSession: true`, `autoRefreshToken: true`

### Roles de Usuário
Armazenadas na tabela `user_roles` (nunca na tabela profiles):
- `admin` — Administrador global (DUB)
- `tenant_admin` — Dono de barbearia parceira
- `cliente` — Cliente final (padrão)

Verificação via função SQL `has_role(user_id, role)` com `SECURITY DEFINER`.

---

## 12. EDGE FUNCTIONS

Todas as Edge Functions rodam em Deno (Supabase Edge Runtime). A maioria tem `verify_jwt = false` no `config.toml`.

### Principais

| Função | Propósito |
|---|---|
| `atomic-booking` | Reserva atômica com verificação de conflitos |
| `check-availability` | Verifica horários disponíveis |
| `create-asaas-pix` | Gera cobrança PIX via Asaas |
| `create-asaas-card` | Processa pagamento por cartão |
| `create-asaas-customer` | Cria cliente no Asaas |
| `create-subscription-pix` | Cria assinatura via PIX |
| `create-subscription-card` | Cria assinatura via cartão |
| `check-subscription-pix` | Verifica status de pagamento PIX de assinatura |
| `cancel-subscription` | Cancela assinatura ativa |
| `asaas-webhook` | Recebe callbacks do gateway Asaas |
| `ai-support-chat` | Chat de suporte com IA |
| `appointment-reminders` | Envia lembretes automáticos |
| `wallet-operations` | Operações de carteira (depósito, saque) |
| `wallet-pin` | Validação e gestão do PIN da carteira |
| `whatsapp-verification` | Verificação de conta via WhatsApp |
| `send-confirmation-email` | Envia email de confirmação |
| `send-webhook-event` | Dispara eventos via webhook |
| `refund-payment` | Reembolso de pagamento |
| `cleanup-pending-payments` | Limpa pagamentos expirados |
| `validate-appointment` | Validação de agendamento |
| `health-check` | Verificação de saúde do sistema |
| `manage-clients` | Gestão de clientes (CRUD) |
| `check-duplicate-signup` | Verifica cadastro duplicado |
| `google-calendar-sync` | Sincronização com Google Calendar |
| `speech-to-text` | Transcrição de áudio para texto |

---

## 13. BANCO DE DADOS — SCHEMA COMPLETO

### Tabelas Principais

| Tabela | Propósito | Colunas-chave |
|---|---|---|
| `profiles` | Perfil do usuário | `id`, `nome`, `email`, `telefone`, `cpf`, `foto_url`, `barbearia_preferida_id`, `unidade_preferida_id`, `origem` |
| `user_roles` | Roles de acesso | `user_id`, `role` (enum: admin, tenant_admin, cliente, moderator, user) |
| `tenants` | Barbearias | `id`, `nome`, `slug`, `logo_url`, `slogan`, `owner_user_id`, `onboarding_completed` |
| `tenant_unidades` | Unidades de barbearias | `id`, `tenant_id`, `nome`, `bairro`, `cidade`, `estado`, `is_sede` |
| `barbeiros` | Profissionais | `id`, `apelido`, `foto_url`, `tenant_id`, `unidade_id`, `user_id`, `ativo`, `comissao_pct` |
| `barbeiros_private` | Dados sensíveis do barbeiro | `barbeiro_id`, `cpf`, `telefone`, `email`, `endereco_*` |
| `servicos` | Serviços oferecidos | `id`, `nome`, `descricao`, `duracao_minutos`, `preco`, `tenant_id` |
| `agendamentos` | Agendamentos | `id`, `user_id`, `barbeiro_id`, `servico_id`, `data`, `hora`, `status`, `preco`, `duracao`, `payment_method` |
| `pending_bookings` | Reservas temporárias (pré-pagamento) | `id`, `user_id`, `data`, `hora`, `pix_qr_code`, `expires_at` |
| `pagamentos` | Pagamentos processados | `id`, `user_id`, `agendamento_id`, `assinatura_id`, `metodo`, `status`, `valor`, `gateway_payment_id` |
| `pontos` | Pontos de fidelidade | `user_id`, `pontos` |
| `resgates` | Resgates de corte grátis | `id`, `user_id`, `status`, `appointment_id` |
| `promocoes` | Regras de fidelidade | `id`, `nome`, `pontos_necessarios`, `ativo`, `tenant_id` |
| `planos` | Planos de assinatura | `id`, `nome`, `preco_mensal`, `limite_agendamentos_mes`, `tenant_id`, `stripe_price_id` |
| `assinaturas` | Assinaturas ativas | `id`, `user_id`, `plano_id`, `status`, `payment_method`, `next_billing_date` |
| `plano_agendamentos_usos` | Uso de agendamentos do plano | `assinatura_id`, `agendamento_id`, `released_at` |
| `creditos` | Créditos/saldo do cliente | `id`, `user_id`, `valor`, `origem`, `usado` |
| `wallet_balances` | Saldo da carteira | `user_id`, `balance` |
| `depositos` | Depósitos na carteira | `id`, `user_id`, `valor`, `status`, `pix_qr_code` |
| `saques` | Saques da carteira | `id`, `user_id`, `valor`, `status` |
| `barbeiro_avaliacoes` | Avaliações de barbeiros | `id`, `barber_id`, `user_id`, `rating`, `comment`, `appointment_id` |
| `barbeiro_portfolio` | Portfólio de fotos | `barbeiro_id`, `image_url`, `descricao` |
| `notificacoes` | Notificações in-app | `id`, `user_id`, `tipo`, `titulo`, `mensagem` |
| `support_conversations` | Conversas de suporte | `id`, `user_id`, `last_message_at` |
| `support_messages` | Mensagens do suporte | `id`, `conversation_id`, `role`, `content` |
| `anuncios_app` | Anúncios/banners | `id`, `titulo`, `descricao`, `imagem_path`, `ativo` |
| `webhook_config` | Configuração do sistema | `webhook_url`, `ativo`, `manutencao_ativa`, `manutencao_mensagem` |
| `audit_logs` | Log de auditoria | `id`, `user_id`, `action`, `entity_type`, `entity_id` |

### Tabelas de Configuração

| Tabela | Propósito |
|---|---|
| `configuracoes_horario` | Horários globais da barbearia |
| `configuracoes_horario_barbeiro` | Horários personalizados por barbeiro |
| `horarios_excepcionais` | Exceções globais (feriados, etc.) |
| `horarios_excepcionais_barbeiro` | Exceções por barbeiro (folgas, etc.) |
| `barbeiro_servico_duracao` | Duração personalizada por barbeiro+serviço |
| `barbeiro_unidades` | Vínculo barbeiro ↔ unidades |
| `chaves_pix` | Chaves PIX cadastradas |
| `contas_bancarias` | Contas bancárias para saque |
| `taxas_gateway` | Taxas por método de pagamento |
| `discount_coupons` | Cupons de desconto |
| `discount_coupon_redemptions` | Uso de cupons |

### Tabelas de Segurança

| Tabela | Propósito |
|---|---|
| `dispositivos_autorizados` | Dispositivos permitidos (admin) |
| `dispositivos_conectados` | Dispositivos ativos do usuário |
| `financeiro_security_config` | Senha do módulo financeiro |
| `financeiro_auth_sessions` | Sessões do financeiro |
| `financeiro_auth_attempts` | Tentativas de login financeiro |
| `email_confirmation_tokens` | Tokens de verificação de email |
| `whatsapp_verification_codes` | Códigos de verificação WhatsApp |
| `account_deletion_feedback` | Feedback de exclusão de conta |

### Tabelas de Loja (futuro)

| Tabela | Propósito |
|---|---|
| `categorias` | Categorias de produtos |
| `produtos` | Produtos da loja |
| `pedidos` | Pedidos |
| `pedido_itens` | Itens dos pedidos |
| `reservas_estoque` | Reservas temporárias de estoque |

### Enums do Banco

| Enum | Valores |
|---|---|
| `appointment_status` | `pending`, `confirmed`, `completed`, `cancelled_by_user`, `cancelled_by_admin`, `no_show` |
| `subscription_status` | `active`, `cancelled`, `suspended`, `pending_cash` |
| `payment_method` | `cash`, `pix`, `credit_card`, `debit_card`, `credit`, `plano`, `resgate` |
| `financial_entry_type` | `income`, `expense` |
| `app_role` | `admin`, `moderator`, `user`, `cliente`, `tenant_admin` |

### Funções SQL Principais

| Função | Propósito |
|---|---|
| `has_role(user_id, role)` | Verifica se usuário tem determinada role |
| `is_admin()` | Verifica se o usuário logado é admin |
| `get_user_available_credits(user_id)` | Calcula créditos disponíveis |
| `use_credits_atomic(user_id, appointment_id, amount)` | Consume créditos atomicamente |
| `get_or_create_wallet_balance(user_id)` | Obtém/cria saldo da carteira |
| `get_maintenance_status()` | Retorna status de manutenção |
| `is_email_allowed_maintenance(email)` | Verifica se email é permitido durante manutenção |
| `is_device_authorized(fingerprint)` | Verifica se dispositivo é autorizado |
| `calcular_saldo_barbeiro(user_id, barbeiro_id)` | Calcula saldo financeiro do barbeiro |
| `validar_saque(user_id, barbeiro_id, valor)` | Valida se saque é permitido |
| `format_phone_for_whatsapp(phone)` | Formata telefone para WhatsApp |
| `clean_expired_pending_bookings()` | Limpa reservas expiradas |
| `auto_suspend_expired_cash_subscriptions()` | Suspende assinaturas cash expiradas |
| `auto_hide_old_cancelled_appointments()` | Oculta cancelamentos antigos (>7 dias) |
| `consume_redemption_on_appointment_insert()` | Consome resgate ao criar agendamento |
| `release_redemption_on_appointment_cancel()` | Devolve resgate ao cancelar |
| `release_plan_use_on_appointment_cancel()` | Libera uso de plano ao cancelar |
| `enforce_resgate_flags()` | Garante que resgates são gratuitos |
| `ensure_tenant_barber(user_id, apelido)` | Cria/vincula barbeiro ao tenant |
| `assign_tenant_admin_role(user_id)` | Atribui role de admin do tenant |
| `create_default_loyalty_promotion()` | Cria promoção padrão para novo tenant |

### Triggers Importantes

| Trigger | Tabela | Ação |
|---|---|---|
| `audit_appointment_changes` | `agendamentos` | Log de auditoria em UPDATE/DELETE |
| `log_appointment_change` | `agendamentos` | Log de mudanças de status/confirmação |
| `set_cancelado_em` | `agendamentos` | Define `cancelado_em` ao cancelar |
| `consume_redemption_on_appointment_insert` | `agendamentos` | Consome resgate no INSERT |
| `release_redemption_on_appointment_cancel` | `agendamentos` | Devolve resgate no cancelamento |
| `release_plan_use_on_appointment_cancel` | `agendamentos` | Libera uso de plano no cancelamento |
| `enforce_resgate_flags` | `agendamentos` | Garante is_free=true e preco=0 para resgates |
| `enforce_barbeiro_id_required` | `agendamentos` | Exige barbeiro_id |
| `trg_send_confirm_message_on_barber_confirm` | `agendamentos` | Envia WhatsApp ao confirmar |
| `on_barber_created` | `barbeiros` | Inicializa horários do barbeiro |
| `create_default_loyalty_promotion` | `tenants` | Cria promoção de fidelidade padrão |
| `create_trial_on_onboarding_complete` | `tenants` | Cria trial de 7 dias no onboarding |
| `validate_barber_review_rating` | `barbeiro_avaliacoes` | Valida rating 1-5 |
| `enforce_barber_review_edit_window` | `barbeiro_avaliacoes` | Bloqueia edição após 24h |
| `update_conversation_last_message` | `support_messages` | Atualiza timestamp da conversa |

---

## 14. SISTEMA DE CACHE

**Arquivo:** `src/utils/cache.ts`

O app usa `sessionStorage` para cache de dados com TTL (Time To Live). Não persiste entre sessões do navegador.

| Chave | TTL | Conteúdo |
|---|---|---|
| `cache_profile_{userId}` | 60 min | `{ profile, preferredShop }` |
| `cache_appointments_{userId}` | 5 min | `{ appointments, payments, pendingBookings }` |
| `cache_loyalty_{userId}` | 5 min | `{ points, credits, redemptions, subscriptions, planUsage }` |
| `cache_shop_{tenantId}` | 30 min | `{ shopBarbers }` |
| `cache_shop_dub` | 30 min | `{ shopBarbers }` (fallback DUB sem tenant) |
| `cliente_last_user_id` | ∞ | ID do último usuário logado (para leitura de cache no boot) |
| `pix_checkout_data` | Sessão | Dados do checkout PIX em andamento |
| `subscription_pix_checkout_data` | Sessão | Dados do checkout PIX de assinatura |
| `resumeToPaymentStep` | Sessão | Dados para retomar pagamento pendente |

---

## 15. REALTIME & CANAIS

O dashboard (`Cliente.tsx`) mantém 3 canais Supabase Realtime simultâneos:

### Canal 1: `canal-agendamentos`
- **Tabelas:** `agendamentos` (filtro: `user_id`), `pending_bookings` (filtro: `user_id`)
- **Eventos:** INSERT, UPDATE, DELETE
- **Ações:**
  - INSERT → recarrega agendamentos + toast "Novo agendamento recebido!"
  - UPDATE → recarrega + toast contextual (confirmado, concluído, cancelado)
  - DELETE → remove do estado local
  - `pending_bookings.*` → recarrega agendamentos

### Canal 2: `canal-fidelidade`
- **Tabelas:** `assinaturas`, `pontos`, `resgates` (filtro: `user_id`), `promocoes`, `planos` (filtro: `tenant_id`)
- **Ações:** Recarrega dados de fidelidade

### Canal 3: `canal-barbeiros` (condicional — só se `tenantId` existe)
- **Tabela:** `barbeiros` (filtro: `tenant_id`)
- **Ações:** Recarrega dados da loja

### Tratamento de Erros de Canal
- Erros nos primeiros 5 segundos são ignorados (transitórios)
- Após 5 segundos, marca canal como desconectado
- Reconexão automática após 30 segundos
- Na reconexão, reinicializa todos os canais + recarrega todos os dados

---

## 16. AUTENTICAÇÃO

### Fluxo de Cadastro
```
1. Usuário preenche formulário (nome, email, telefone, CPF, senha)
2. Frontend chama Edge Function `check-duplicate-signup` para verificar duplicatas
3. `supabase.auth.signUp()` com metadados (nome, telefone, cpf, origem)
4. Redireciona para verificação (email ou WhatsApp dependendo da configuração)
5. Após verificação, login automático
6. `checkUserRoleAndRedirect()` — verifica role e redireciona
```

### Fluxo de Login
```
1. Usuário insere email e senha
2. `supabase.auth.signInWithPassword()`
3. Verifica se email foi confirmado
4. `checkUserRoleAndRedirect()`:
   - Busca roles em `user_roles`
   - Se `cliente` → `/cliente`
   - Se `admin` ou `tenant_admin` → app externo do barbeiro
```

### Sessão
- Persistida em `localStorage`
- Auto-refresh de token habilitado
- `AuthSessionGuard` monitora eventos de auth e limpa sessões inválidas
- Ao detectar `TOKEN_REFRESHED`, loga no console
- Ao detectar sessão inválida, faz `signOut()` e redireciona para `/auth`

### Origens de Cadastro
- `dub_exclusive` — Cliente direto da DUB (vincula automaticamente ao tenant DUB)
- `{slug}` — Cliente vindo da página pública de uma barbearia parceira

---

## 17. MULTI-TENANCY

O sistema é **multi-tenant** — uma única instância serve múltiplas barbearias.

### Conceitos
- **Tenant** = Uma barbearia. Cada tenant tem `id`, `nome`, `slug`, `owner_user_id`.
- **Barbearia DUB** = Tenant flagship. Historicamente usava `tenant_id IS NULL` (legado). Agora tem um `tenant_id` específico no banco.
- **`barbearia_preferida_id`** = Campo no `profiles` que indica qual barbearia o cliente usa atualmente.

### Isolamento de Dados
Todos os dados são filtrados por `tenant_id`:
- Barbeiros → `barbeiros.tenant_id`
- Serviços → `servicos.tenant_id`
- Planos → `planos.tenant_id`
- Promoções → `promocoes.tenant_id`
- Cupons → `discount_coupons.tenant_id`

### Utilitário Centralizado
```typescript
// src/utils/tenantQuery.ts
buildBarberQuery(tenantId, unidadeId?) // Query de barbeiros
applyTenantFilter(query, tenantId)     // Aplica filtro em query existente
```
Trata automaticamente o caso legado (`tenant_id IS NULL` = DUB global).

### Troca de Barbearia
1. Cliente acessa `/escolher-barbearia`
2. Seleciona uma barbearia diferente
3. `profiles.barbearia_preferida_id` é atualizado no banco
4. Cache anterior é invalidado
5. Dados da nova barbearia são carregados (barbeiros, serviços, planos)

---

## 18. FLUXO DE AGENDAMENTO

### Etapas (ClienteAgendar.tsx)

```
Etapa 1 → Selecionar Unidade (se barbearia tem múltiplas)
  ↓
Etapa 2 → Selecionar Barbeiro
  ↓
Etapa 3 → Selecionar Serviço(s) (multi-seleção)
  ↓
Etapa 4 → Selecionar Data (calendário horizontal)
  ↓
Etapa 5 → Selecionar Horário (slots de 30min)
  ↓
Etapa 6 → Selecionar Pagamento (dinheiro, cartão, PIX, carteira, plano, resgate)
  ↓
Etapa 7 → Confirmar → Edge Function `atomic-booking`
```

### Verificação de Disponibilidade
- Edge Function `check-availability` verifica conflitos de horário
- Considera: horários do barbeiro, exceções, almoço, delay entre serviços, agendamentos existentes
- **A verificação final de conflito é ATÔMICA dentro do `atomic-booking`** (não no frontend)

### Métodos de Pagamento
| Método | Fluxo |
|---|---|
| `cash` | Agendamento criado imediatamente, pagamento na barbearia |
| `pix` | Gera QR Code via Asaas → redireciona para `ClientePixCheckout` → confirma via webhook |
| `credit_card` | Processa via Asaas → confirma imediatamente |
| `credit` (carteira) | Desconta do saldo via `use_credits_atomic` |
| `plano` | Consume 1 uso do plano ativo → registra em `plano_agendamentos_usos` |
| `resgate` | Consume 1 resgate disponível → trigger `consume_redemption_on_appointment_insert` |

---

## 19. SISTEMA DE FIDELIDADE

### Funcionamento
1. A cada corte concluído (`status = 'completed'`), o cliente ganha 1 ponto
2. Quando atinge X pontos (configurável por tenant via `promocoes.pontos_necessarios`), ganha 1 resgate
3. Resgate = 1 corte grátis, disponível como método de pagamento "resgate"
4. O resgate é consumido atomicamente via trigger no INSERT de agendamento

### Tabelas Envolvidas
- `pontos` — Contador de pontos (`user_id`, `pontos`)
- `resgates` — Resgates disponíveis (`user_id`, `status: 'available' | 'used'`, `appointment_id`)
- `promocoes` — Regras (`pontos_necessarios`, `tenant_id`)

### Visual
- `LoyaltyCard` — Exibe progresso com círculos preenchidos (1 por ponto)
- `PointsDetailModal` — Detalhamento completo

---

## 20. PLANOS E ASSINATURAS

### Modelo
- **Plano** (`planos`) — Define: nome, preço mensal, limite de agendamentos/mês, serviço vinculado, barbeiro vinculado
- **Assinatura** (`assinaturas`) — Vínculo entre usuário e plano: status, método de pagamento, próxima cobrança

### Status de Assinatura
| Status | Significado |
|---|---|
| `active` | Plano ativo, cortes liberados |
| `suspended` | Pagamento PIX pendente |
| `pending_cash` | Aguardando pagamento em dinheiro na barbearia |
| `cancelled` | Cancelado |

### Métodos de Pagamento de Plano
- **PIX** — Gera cobrança recorrente via Asaas
- **Cartão** — Cobrança recorrente via Asaas
- **Dinheiro (cash)** — Barbeiro confirma manualmente na barbearia

### Uso de Agendamentos do Plano
- Cada uso é registrado em `plano_agendamentos_usos`
- Se o agendamento é cancelado, o uso é liberado (`released_at`)
- Visual: `PlanTrackerCard` mostra "X de Y usados este mês"

---

## 21. PAGAMENTOS

### Gateway: Asaas
O app utiliza o **Asaas** como gateway de pagamento principal.

### Edge Functions de Pagamento
| Função | Descrição |
|---|---|
| `create-asaas-customer` | Cria cliente no Asaas (CPF, nome, email) |
| `create-asaas-pix` | Gera cobrança PIX (QR Code + payload) |
| `create-asaas-card` | Processa pagamento por cartão |
| `create-subscription-pix` | Cria assinatura recorrente via PIX |
| `create-subscription-card` | Cria assinatura recorrente via cartão |
| `asaas-webhook` | Recebe notificações do Asaas (pagamento confirmado, etc.) |
| `refund-payment` | Processa reembolso |
| `check-subscription-pix` | Verifica status de pagamento PIX de assinatura |

### Checkout PIX
1. Frontend chama `create-asaas-pix` com dados do agendamento
2. Recebe: QR Code (imagem), payload (copia e cola), `payment_id`, `expires_at`
3. Redireciona para `ClientePixCheckout`
4. Usuário paga via app do banco
5. Asaas envia webhook para `asaas-webhook`
6. Webhook atualiza status do pagamento e confirma agendamento

### Carteira Digital
- Saldo mantido em `wallet_balances`
- Depósitos via PIX (`depositos`)
- Consumo no agendamento via `use_credits_atomic` (RPC atômica)
- PIN de segurança via Edge Function `wallet-pin`

---

## 22. SISTEMA DE MANUTENÇÃO

### Configuração
Gerenciado via tabela `webhook_config`:
| Campo | Tipo | Descrição |
|---|---|---|
| `manutencao_ativa` | boolean | Manutenção está ativa? |
| `manutencao_mensagem` | text | Mensagem exibida na tela de manutenção |
| `manutencao_inicio_programada` | timestamptz | Início programado |
| `manutencao_fim_programada` | timestamptz | Fim programado |
| `manutencao_aviso_ativo` | boolean | Aviso prévio ativo? |
| `manutencao_aviso_mensagem` | text | Mensagem do aviso |
| `manutencao_ips_permitidos` | text[] | IPs que podem acessar |

### Emails Permitidos
Tabela `manutencao_emails_permitidos` — emails que podem acessar durante manutenção.
Verificado via função SQL `is_email_allowed_maintenance(email)`.

### Comportamento
- **Rotas públicas** (login, cadastro, etc.) → sempre acessíveis
- **Usuários permitidos** → veem banner de aviso mas acessam normalmente
- **Usuários não permitidos** → veem `MaintenanceScreen` com mensagem e botão "Sair"
- Sincronização via Realtime + polling

---

## 23. TRATAMENTO DE ERROS

### Camadas de Proteção

1. **`GlobalErrorBoundary`** — Captura erros não-tratados do React. Exibe tela de erro genérica.

2. **`useDataError`** — Gerencia erros das 4 camadas de dados:
   - Filtra falsos positivos automaticamente
   - Ignora erros nos primeiros 4s (startup)
   - Exibe toast não-bloqueante com botão "Tentar novamente"
   - Máximo de 2 retries automáticos

3. **`AuthSessionGuard`** — Limpa sessões inválidas e redireciona para login.

4. **Realtime Error Handling** — Reconexão automática de canais com backoff de 30s.

5. **Cache Fallback** — Se dados estão em cache, a tela renderiza imediatamente enquanto busca dados frescos.

### Toast de Erro de Dados
```
"Alguns dados podem estar desatualizados. Toque para tentar novamente."
```
- Aparece apenas se `hasError = true`
- Dismissável após 8 segundos
- Botão "Tentar novamente" chama `retryAllLayers()` que usa `Promise.allSettled`

---

## DIAGRAMA DE FLUXO GERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO                                  │
└─────────┬───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐     ┌────────────────────┐
│    Landing Page (/)  │────▶│  Auth (/auth)      │
│  • Seja Cliente DUB  │     │  • Login            │
│  • Encontrar Barb.   │     │  • Cadastro         │
└─────────────────────┘     │  • Zod validation   │
          │                  │  • check-duplicate  │
          ▼                  └────────┬───────────┘
┌─────────────────────┐              │
│ Escolher Barbearia  │              ▼
│ (/escolher-barb.)   │     ┌────────────────────┐
│  • Lista tenants     │     │  Verificação       │
│  • Geolocalização    │     │  • Email            │
│  • Avaliações        │     │  • WhatsApp         │
└─────────────────────┘     └────────┬───────────┘
                                     │
                                     ▼
                            ┌────────────────────┐
                            │  Dashboard Cliente  │
                            │  (/cliente)         │
                            │                     │
                            │  ┌─── Header ────┐  │
                            │  │ Nome + Avatar  │  │
                            │  └───────────────┘  │
                            │  ┌─── Barbearia ─┐  │
                            │  │ DUB • Trocar   │  │
                            │  └───────────────┘  │
                            │  ┌─── Fidelidade ─┐ │
                            │  │ ●●●●○○○○ 4/8   │ │
                            │  │ ou PlanTracker  │ │
                            │  └───────────────┘  │
                            │  ┌── Agendar ─────┐ │
                            │  │ [AGENDAR HORÁRIO]│ │
                            │  └───────────────┘  │
                            │  ┌── Agendamentos ─┐│
                            │  │ Card 1 (pending) ││
                            │  │ Card 2 (confirm) ││
                            │  └───────────────┘  │
                            │                     │
                            │  ┌─ Nav Inferior ──┐│
                            │  │ Início│Loja│Plan│Perfil│
                            │  └───────────────┘  │
                            └────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │  Agendar     │ │  Perfil      │ │  Suporte     │
           │  (7 etapas)  │ │  • Dados     │ │  • Chat IA   │
           │  • Barbeiro  │ │  • Segurança │ │              │
           │  • Serviço   │ │  • Barbearia │ └──────────────┘
           │  • Data/Hora │ │  • Carteira  │
           │  • Pagamento │ │  • Histórico │
           │  • Confirmar │ │  • Tema      │
           └──────────────┘ └──────────────┘
```

---

> **Nota:** Esta documentação reflete o estado do código em 2026-03-11. Alterações futuras devem ser registradas no `CHANGELOG.md`.
