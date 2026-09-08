import { useEffect, useRef, useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { SplashScreen } from "@/components/SplashScreen";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, setupQueryPersistence, clearPersistedCache } from "@/lib/queryClient";
import { AuthProvider, useAuth, getCachedUser } from "@/contexts/AuthProvider";
import { prefetchClientRoutes } from "@/lib/routePrefetch";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { useStoreMaintenanceMode } from "@/hooks/useStoreMaintenanceMode";
import { useRefreshRequired } from "@/hooks/useRefreshRequired";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { RefreshRequiredScreen } from "@/components/RefreshRequiredScreen";
import { RootLayout } from "@/routes/RootLayout";

import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense } from "react";
import { SupportChatBubble } from "@/components/support/SupportChatBubble";
import { getVerifiedAuthUser } from "@/utils/authSession";

// Lazy-loaded routes for reduced initial bundle
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const VerificarWhatsApp = lazy(() => import("./pages/VerificarWhatsApp"));
const EscolherVerificacao = lazy(() => import("./pages/EscolherVerificacao"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CompletarPerfil = lazy(() => import("./pages/CompletarPerfil"));
const Cliente = lazy(() => import("./pages/Cliente"));
const ClienteAgendar = lazy(() => import("./pages/ClienteAgendar"));
const ClienteAssinar = lazy(() => import("./pages/ClienteAssinar"));
const ClientePagamento = lazy(() => import("./pages/ClientePagamento"));
const ClientePixCheckout = lazy(() => import("./pages/ClientePixCheckout"));
const SubscriptionPixCheckout = lazy(() => import("./pages/SubscriptionPixCheckout"));
const ClienteCarteira = lazy(() => import("./pages/ClienteCarteira"));
const ClientePerfil = lazy(() => import("./pages/ClientePerfil"));
const ClienteCupons = lazy(() => import("./pages/ClienteCupons"));
const ClienteHistorico = lazy(() => import("./pages/ClienteHistorico"));
const ClienteAvaliacoes = lazy(() => import("./pages/ClienteAvaliacoes"));
const ClienteIndicacoes = lazy(() => import("./pages/ClienteIndicacoes"));
const ConviteRedirect = lazy(() => import("./pages/ConviteRedirect"));
const ClienteDadosPessoais = lazy(() => import("./pages/ClienteDadosPessoais"));
const ClienteSeguranca = lazy(() => import("./pages/ClienteSeguranca"));
const ClienteBarbearia = lazy(() => import("./pages/ClienteBarbearia"));
const ClienteLoja = lazy(() => import("./pages/ClienteLoja"));
const SupportChat = lazy(() => import("./pages/SupportChat"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BarberReviews = lazy(() => import("./pages/BarberReviews"));
const EscolherBarbearia = lazy(() => import("./pages/EscolherBarbearia"));
const AdminFixCoordinates = lazy(() => import("./pages/AdminFixCoordinates"));
const AdminEfiCredenciais = lazy(() => import("./pages/AdminEfiCredenciais"));
const BarbershopPublic = lazy(() => import("./pages/BarbershopPublic"));
const BarbershopUnidades = lazy(() => import("./pages/BarbershopUnidades"));
const Flowchart = lazy(() => import("./pages/Flowchart"));
const ResponsivePreview = lazy(() => import("./pages/ResponsivePreview"));
const BarbershopsCityGuide = lazy(() => import("./pages/BarbershopsCityGuide"));

/** Minimal loading fallback */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-dvh bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

setupQueryPersistence();

// Routes that are always accessible (before login)
const PUBLIC_ROUTES = [
  '/',
  '/auth',
  '/auth/callback',
  '/verificar-email',
  '/verificar-whatsapp',
  '/escolher-verificacao',
  '/esqueci-senha',
  '/resetar-senha',
  '/escolher-barbearia',
  '/flowchart',
];

function MaintenanceWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    isMaintenanceMode, 
    maintenanceMessage, 
    isLoading, 
    isAllowedUser,
    isAuthenticated,
    warningActive,
    warningMessage
  } = useMaintenanceMode();

  // Check if current route is public (before login)
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith('/auth') || location.pathname.startsWith('/b/') || location.pathname.startsWith('/barbearias') || location.pathname.startsWith('/i/') || location.pathname.startsWith('/barbearia-dub/')
  );

  // Also treat /:slug and /:slug/:code (barbershop public pages / invite links) as public
  const _segs = location.pathname.split('/').filter(Boolean);
  const _reserved = ['cliente', 'suporte', 'admin', 'auth', 'barbearias', 'b', 'i', 'escolher-barbearia', 'escolher-verificacao', 'verificar-email', 'verificar-whatsapp', 'completar-perfil', 'esqueci-senha', 'resetar-senha', 'flowchart', 'responsive-preview'];
  const isBarbershopSlug = (_segs.length === 1 || _segs.length === 2) &&
    !_reserved.includes(_segs[0]);

  // Public routes NEVER wait for maintenance check — render immediately
  if (isPublicRoute || isBarbershopSlug) {
    return (
      <div className="flex flex-col min-h-dvh">
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    );
  }

  // Se o app NÃO está em modo de manutenção, renderiza direto (zero tela branca ou espera desnecessária)
  if (!isMaintenanceMode) {
    return (
      <div className="flex flex-col min-h-dvh">
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    );
  }

  // Modo manutenção ativo: se ainda está checando permissões do usuário, exibe loader com spinner em vez de tela branca
  if (isLoading) {
    return <PageLoader />;
  }

  // Allowed users can access everything even during maintenance
  if (isAllowedUser) {
    return (
      <div className="flex flex-col min-h-dvh">
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    );
  }

  // If maintenance is active and user is not allowed
  return (
    <MaintenanceScreen 
      message={maintenanceMessage || undefined}
      onExit={() => {
        navigate('/');
      }}
    />
  );
}

function StoreMaintenanceGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { isStoreMaintenanceMode, maintenanceMessage, isLoading } = useStoreMaintenanceMode();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isStoreMaintenanceMode) {
    return (
      <MaintenanceScreen
        message={maintenanceMessage || undefined}
        onExit={() => {
          navigate("/cliente");
        }}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Limpa o cache (memória + persistido) no logout e faz prefetch das rotas quentes.
 */
function AuthSessionGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearPersistedCache();
    });

    prefetchClientRoutes();

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}

const PUBLIC_PREFIXES = ['/auth', '/b/', '/i/', '/barbearia-dub/'];
const PUBLIC_EXACT = [
  '/esqueci-senha', '/resetar-senha', '/verificar-email', '/verificar-whatsapp',
  '/escolher-verificacao', '/escolher-barbearia', '/completar-perfil',
  '/flowchart', '/responsive-preview',
];
const RESERVED_SEGMENTS = ['cliente', 'suporte', 'admin', 'auth', 'barbearias', 'b', 'i', 'escolher-barbearia', 'escolher-verificacao', 'verificar-email', 'verificar-whatsapp', 'completar-perfil', 'esqueci-senha', 'resetar-senha', 'flowchart', 'responsive-preview'];

/**
 * Redireciona usuários logados da landing direto para /cliente.
 * A decisão é SÍNCRONA (sessão lida do storage) — zero tela branca.
 */
function AuthRedirectGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute =
    PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p)) ||
    PUBLIC_EXACT.includes(location.pathname);

  const segments = location.pathname.split('/').filter(Boolean);
  const isBarbershopSlug = (segments.length === 1 || segments.length === 2) &&
    !RESERVED_SEGMENTS.includes(segments[0]);

  const shouldRedirect =
    !isPublicRoute && !isBarbershopSlug && location.pathname === '/' && !!getCachedUser();

  useEffect(() => {
    if (shouldRedirect) navigate('/cliente', { replace: true });
  }, [shouldRedirect, navigate]);

  if (shouldRedirect) return <PageLoader />;

  return <>{children}</>;
}



function ScrollLockGuard() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/suporte") {
      // A própria tela de suporte gerencia o lock de scroll.
      // O guard global continua limpando estilos residuais em todas as rotas.
    }


    document.documentElement.classList.remove("lock-scroll");
    document.body.classList.remove("lock-scroll");

    document.documentElement.style.overflow = "";
    document.documentElement.style.overflowX = "";
    document.documentElement.style.overflowY = "";
    document.body.style.overflow = "";
    document.body.style.overflowX = "";
    document.body.style.overflowY = "";
    document.documentElement.style.position = "";
    document.body.style.position = "";
    document.documentElement.style.width = "";
    document.body.style.width = "";
    document.documentElement.style.height = "";
    document.body.style.height = "";
    document.body.style.minHeight = "";
    document.documentElement.style.top = "";
    document.body.style.top = "";
    document.documentElement.style.left = "";
    document.body.style.left = "";
    document.documentElement.style.right = "";
    document.body.style.right = "";
    document.documentElement.style.bottom = "";
    document.body.style.bottom = "";
    document.documentElement.style.paddingRight = "";
    document.body.style.paddingRight = "";
    document.documentElement.style.removeProperty("touch-action");
    document.body.style.removeProperty("touch-action");
    document.documentElement.style.removeProperty("overscroll-behavior");
    document.body.style.removeProperty("overscroll-behavior");
    document.documentElement.style.removeProperty("overscroll-behavior-y");
    document.body.style.removeProperty("overscroll-behavior-y");
    document.body.style.removeProperty("-webkit-overflow-scrolling");
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  const { showRefreshOverlay, handleRefresh } = useRefreshRequired();

  return (
    <AuthSessionGuard>
      {showRefreshOverlay && <RefreshRequiredScreen onRefresh={handleRefresh} />}
      <AuthRedirectGuard>
        <ScrollLockGuard />
        <MaintenanceWrapper>

          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<RootLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/verificar-email" element={<EmailVerification />} />
                <Route path="/verificar-whatsapp" element={<VerificarWhatsApp />} />
                <Route path="/escolher-verificacao" element={<EscolherVerificacao />} />
                <Route path="/esqueci-senha" element={<ForgotPassword />} />
                <Route path="/resetar-senha" element={<ResetPassword />} />
                <Route path="/completar-perfil" element={<CompletarPerfil />} />
                <Route path="/cliente" element={<Cliente />} />
                <Route path="/cliente/agendar" element={<ClienteAgendar />} />
                <Route path="/cliente/assinar" element={<ClienteAssinar />} />
                <Route path="/cliente/pagamento" element={<ClientePagamento />} />
                <Route path="/cliente/pix-checkout" element={<ClientePixCheckout />} />
                <Route path="/cliente/assinatura-pix" element={<SubscriptionPixCheckout />} />
                <Route path="/cliente/carteira" element={<ClienteCarteira />} />
                <Route path="/cliente/perfil" element={<ClientePerfil />} />
                <Route path="/cliente/cupons" element={<ClienteCupons />} />
                <Route path="/cliente/historico" element={<ClienteHistorico />} />
                <Route path="/cliente/avaliacoes" element={<ClienteAvaliacoes />} />
                <Route path="/cliente/indicacoes" element={<ClienteIndicacoes />} />
                <Route path="/cliente/dados-pessoais" element={<ClienteDadosPessoais />} />
                <Route path="/cliente/seguranca" element={<ClienteSeguranca />} />
                <Route path="/cliente/barbearia" element={<ClienteBarbearia />} />
                <Route path="/cliente/loja" element={<StoreMaintenanceGate><ClienteLoja /></StoreMaintenanceGate>} />
                <Route path="/cliente/barbeiro/:barberId/avaliacoes" element={<BarberReviews />} />
                <Route path="/suporte" element={<SupportChat />} />
                <Route path="/escolher-barbearia" element={<EscolherBarbearia />} />
                <Route path="/admin/fix-coordinates" element={<AdminFixCoordinates />} />
                <Route path="/admin/efi-credenciais" element={<AdminEfiCredenciais />} />
                <Route path="/b/:slug/unidades" element={<BarbershopUnidades />} />
                <Route path="/b/:slug" element={<BarbershopPublic />} />
                <Route path="/barbearias" element={<BarbershopsCityGuide />} />
                <Route path="/barbearias/:cidade" element={<BarbershopsCityGuide />} />
                <Route path="/i/:code" element={<ConviteRedirect />} />
                <Route path="/barbearia-dub/:code" element={<ConviteRedirect />} />
                <Route path="/:slug/:code" element={<ConviteRedirect />} />
                <Route path="/:slug" element={<BarbershopPublic />} />
                <Route path="/flowchart" element={<Flowchart />} />
                <Route path="/responsive-preview" element={<ResponsivePreview />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
          <SupportChatBubble />
        </MaintenanceWrapper>
      </AuthRedirectGuard>
    </AuthSessionGuard>
  );
}

function ThemeColorSync() {
  useEffect(() => {
    const FORCE_COLOR = "#FFFFFF";
    let isApplying = false;

    const applyColor = () => {
      if (isApplying) return;
      isApplying = true;

      // Ensure color-scheme is light
      document.documentElement.style.colorScheme = "light";
      document.documentElement.style.backgroundColor = FORCE_COLOR;
      if (document.body) {
        document.body.style.backgroundColor = FORCE_COLOR;
        document.body.style.colorScheme = "light";
      }

      // Update or create meta tags for plain, light, and dark schemes
      const desiredMetas = [
        { media: null, content: FORCE_COLOR },
        { media: "(prefers-color-scheme: light)", content: FORCE_COLOR },
        { media: "(prefers-color-scheme: dark)", content: FORCE_COLOR },
      ];

      const existingMetas = Array.from(
        document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      );


      desiredMetas.forEach(({ media, content }) => {
        let meta = existingMetas.find((m) =>
          media ? m.getAttribute("media") === media : !m.hasAttribute("media")
        );
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = "theme-color";
          if (media) meta.setAttribute("media", media);
          document.head.prepend(meta);
        }
        if (meta.getAttribute("content") !== content) {
          meta.setAttribute("content", content);
        }
      });

      // Remove any extra theme-color metas that don't match
      existingMetas.forEach((m) => {
        const mMedia = m.getAttribute("media");
        const isKnown =
          !mMedia ||
          mMedia === "(prefers-color-scheme: light)" ||
          mMedia === "(prefers-color-scheme: dark)";
        if (!isKnown) {
          m.remove();
        }
      });

      queueMicrotask(() => {
        isApplying = false;
      });
    };

    applyColor();

    const headObserver = new MutationObserver(applyColor);
    headObserver.observe(document.head, { childList: true, subtree: true });

    const htmlObserver = new MutationObserver(applyColor);
    htmlObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      headObserver.disconnect();
      htmlObserver.disconnect();
    };
  }, []);
  return null;
}

function AppWithSplash() {
  // Splash só na primeira abertura da sessão do navegador — navegações
  // internas e reloads na mesma sessão entram direto (zero espera).
  const firstOpen = useRef(
    typeof window !== "undefined" && !sessionStorage.getItem("dub_splash_shown")
  );
  const [showSplash, setShowSplash] = useState(firstOpen.current);

  useEffect(() => {
    if (!firstOpen.current) return;
    sessionStorage.setItem("dub_splash_shown", "1");
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <SplashScreen visible={showSplash} />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
      <ThemeColorSync />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppWithSplash />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
