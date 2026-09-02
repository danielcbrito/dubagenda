import { useEffect, useRef } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

const DIAGRAM = `graph TD
    subgraph FRONTEND["FRONTEND - React + Vite"]
        SPLASH[SplashScreen 2s]
        AUTH_GUARD[AuthSessionGuard]
        MAINT[MaintenanceWrapper]
        ROUTER[React Router - Lazy Loading]

        SPLASH --> AUTH_GUARD --> MAINT --> ROUTER

        ROUTER --> LANDING["Landing Page /"]
        ROUTER --> AUTH_PAGE["Auth /auth"]
        ROUTER --> DASHBOARD["Dashboard /cliente"]
        ROUTER --> BOOKING["Agendamento /cliente/agendar"]
        ROUTER --> SUPPORT["Suporte IA /suporte"]
        ROUTER --> PUBLIC["Barbearia Publica /:slug"]
    end

    subgraph DASHBOARD_LAYERS["DASHBOARD - 4 Camadas Progressivas"]
        L1["Camada 1: Perfil + Tenant"]
        L2["Camada 2: Agendamentos"]
        L3["Camada 3: Fidelidade + Assinaturas"]
        L4["Camada 4: Barbeiros da Barbearia"]

        L1 -->|tenant_id| L2
        L1 -->|tenant_id| L3
        L1 -->|tenant_id| L4
    end

    subgraph BOOKING_FLOW["FLUXO DE AGENDAMENTO - 6 Passos"]
        B1["1. Selecionar Profissional"]
        B2["2. Selecionar Servico"]
        B3["3. Selecionar Data"]
        B4["4. Selecionar Horario"]
        B5["5. Forma de Pagamento"]
        B6["6. Confirmacao Atomica"]

        B1 --> B2 --> B3 --> B4 --> B5 --> B6
    end

    subgraph SUPABASE["SUPABASE - Backend"]
        AUTH[Auth - JWT + OAuth]
        DB["PostgreSQL + RLS"]
        REALTIME[Realtime WebSockets]
        STORAGE[Storage - Fotos]

        subgraph EDGE_FN["Edge Functions - Deno"]
            EF1[atomic-booking]
            EF2[check-availability]
            EF3[create-asaas-pix]
            EF4[create-asaas-card]
            EF5[asaas-webhook]
            EF6[ai-support-chat]
            EF7[appointment-reminders]
            EF8[wallet-operations]
            EF9[send-webhook-event]
            EF10[create-checkout / verify-stripe]
        end

        subgraph TABLES["Tabelas Principais"]
            T_PROFILES[profiles]
            T_AGEND[agendamentos]
            T_SERVICOS[servicos]
            T_BARBEIROS[barbeiros]
            T_PLANOS[planos]
            T_ASSINAT[assinaturas]
            T_PAGAM[pagamentos]
            T_PONTOS[pontos]
            T_RESGATES[resgates]
            T_CREDITOS[creditos]
            T_TENANTS[tenants]
            T_PENDING[pending_bookings]
            T_NOTIF[notificacoes]
        end
    end

    subgraph EXTERNAL["INTEGRACOES EXTERNAS"]
        ASAAS[Asaas Gateway - PIX + Cartao]
        STRIPE[Stripe - Checkout + Assinaturas]
        WHATSAPP[WhatsApp via n8n Webhook]
        GCAL[Google Calendar Sync]
        OPENAI[OpenAI - Suporte IA]
    end

    subgraph CACHE["CACHE - sessionStorage"]
        C1["Perfil - 60min TTL"]
        C2["Agendamentos - 5min TTL"]
        C3["Fidelidade - 5min TTL"]
        C4["Barbeiros - 30min TTL"]
    end

    DASHBOARD --> DASHBOARD_LAYERS
    BOOKING --> BOOKING_FLOW

    FRONTEND -->|supabase-js SDK| AUTH
    FRONTEND -->|queries + RPC| DB
    FRONTEND -->|subscribe channels| REALTIME
    FRONTEND -->|sessionStorage| CACHE

    B6 -->|POST| EF1
    B4 -->|POST| EF2
    B5 -->|PIX| EF3
    B5 -->|Cartao| EF4
    B5 -->|Stripe| EF10

    EF1 -->|INSERT| T_AGEND
    EF1 -->|DELETE| T_PENDING
    EF5 -->|Webhook Asaas| T_PAGAM
    EF5 -->|Confirma| T_AGEND

    EF3 --> ASAAS
    EF4 --> ASAAS
    EF5 --> ASAAS
    EF10 --> STRIPE
    EF6 --> OPENAI
    EF9 --> WHATSAPP

    REALTIME -->|agendamentos changes| DASHBOARD_LAYERS
    REALTIME -->|assinaturas changes| DASHBOARD_LAYERS
    REALTIME -->|barbeiros changes| DASHBOARD_LAYERS

    DB -->|Trigger confirmacao| WHATSAPP
    DB -->|Trigger consume resgate| T_RESGATES
    DB -->|Trigger audit log| T_PROFILES

    EF7 --> WHATSAPP
    EF7 --> GCAL`;

declare global {
  interface Window {
    mermaid: any;
  }
}

export default function Flowchart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function loadMermaid() {
      if (!window.mermaid) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = MERMAID_CDN;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Mermaid"));
          document.head.appendChild(script);
        });
      }

      if (cancelled || !containerRef.current) return;

      window.mermaid.initialize({
        theme: "dark",
        startOnLoad: false,
        securityLevel: "loose",
      });

      const { svg } = await window.mermaid.render("flowchart-svg", DIAGRAM);
      if (!cancelled && containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    }

    loadMermaid().catch(console.error);
    return () => { cancelled = true; };
  }, []);

  const handleDownload = () => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dub-agenda-flowchart.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <h1 className="text-sm font-semibold tracking-wide uppercase text-foreground">
          Arquitetura DUB
        </h1>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Download className="w-4 h-4" />
          SVG
        </button>
      </div>

      {/* Diagram */}
      <div className="p-4 overflow-auto">
        <div
          ref={containerRef}
          className="flex justify-center min-w-[800px]"
        >
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    </div>
  );
}
