import { useEffect, useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { SplashScreen } from "@/components/SplashScreen";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { useStoreMaintenanceMode } from "@/hooks/useStoreMaintenanceMode";
import { useRefreshRequired } from "@/hooks/useRefreshRequired";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { RefreshRequiredScreen } from "@/components/RefreshRequiredScreen";


import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense } from "react";
import { SupportChatBubble } from "@/components/support/SupportChatBubble";

// Lazy-loaded routes for reduced initial bundle
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 1,
      retryDelay: (n) => Math.min(1000 * 2 ** n, 10000),
      staleTime: 2 * 60 * 1000, // 2 min default
    },
    mutations: { retry: 0 },
  },
});

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
    location.pathname === route || location.pathname.startsWith('/auth') || location.pathname.startsWith('/b/')
  );

  // Also treat /:slug (barbershop public pages) as public
  const isBarbershopSlug = !location.pathname.startsWith('/cliente') && 
    !location.pathname.startsWith('/suporte') &&
    location.pathname.split('/').filter(Boolean).length === 1;

  // If still loading, show nothing (to avoid flash)
  if (isLoading) {
    return null;
  }

  // Public routes (login, signup, etc.) are always accessible
  if (isPublicRoute || isBarbershopSlug) {
    return (
      <div className="flex flex-col min-h-dvh">
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    );
  }

  // Allowed users can access everything
  if (isAllowedUser) {
    return (
      <div className="flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    );
  }

  // If user is authenticated but NOT allowed, and maintenance is active
  if (isAuthenticated && isMaintenanceMode) {
    return (
      <MaintenanceScreen 
        message={maintenanceMessage || undefined}
        onExit={() => {
          navigate('/');
        }}
      />
    );
  }

  // Normal flow
  return (
    <div className="flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
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
 * Limpa sessões inválidas automaticamente para evitar loops de erro
 */
function AuthSessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token renovado com sucesso');
      }
      if (event === 'SIGNED_OUT') {
        console.log('[Auth] Usuário fez logout');
        queryClient.clear();
      }
      if (event === 'SIGNED_IN') {
        console.log('[Auth] Sessão restaurada/login');
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.warn('[Auth] Erro ao verificar sessão (não deslogando):', error.message);
      } else if (data.session) {
        console.log('[Auth] Sessão ativa encontrada');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}

/**
 * Redireciona usuários logados da landing page direto para /cliente.
 * Verifica sessão ANTES de renderizar a rota.
 */
function AuthRedirectGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Rotas públicas que não precisam de verificação
    const isPublicRoute =
      location.pathname.startsWith('/auth') ||
      location.pathname.startsWith('/b/') ||
      location.pathname === '/esqueci-senha' ||
      location.pathname === '/resetar-senha' ||
      location.pathname === '/verificar-email' ||
      location.pathname === '/verificar-whatsapp' ||
      location.pathname === '/escolher-verificacao' ||
      location.pathname === '/escolher-barbearia' ||
      location.pathname === '/completar-perfil' ||
      location.pathname === '/flowchart' ||
      location.pathname === '/responsive-preview';

    // Rotas de barbearia pública (/:slug — single segment, not a known route)
    const segments = location.pathname.split('/').filter(Boolean);
    const isBarbershopSlug = segments.length === 1 &&
      !['cliente', 'suporte', 'admin', 'auth', 'barbearias'].includes(segments[0]);

    if (isPublicRoute || isBarbershopSlug) {
      setReady(true);
      return;
    }

    // Só verifica redirect na landing page "/"
    if (location.pathname !== '/') {
      setReady(true);
      return;
    }

    // Verificar sessão para redirecionar da landing
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate('/cliente', { replace: true });
          return;
        }

        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (refreshed) {
          navigate('/cliente', { replace: true });
          return;
        }
      } catch {
        // Ignora erro — mostra landing normalmente
      }
      setReady(true);
    };

    check();
  }, [location.pathname]);

  if (!ready) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

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
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/:slug" element={<BarbershopPublic />} />
              <Route path="/flowchart" element={<Flowchart />} />
              <Route path="/responsive-preview" element={<ResponsivePreview />} />
              <Route path="*" element={<NotFound />} />
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
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      const color = isDark ? "#0D0D0D" : "#F5F5F5";
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((meta) => meta.setAttribute("content", color));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Set initial value
    const isDark = document.documentElement.classList.contains("dark");
    const color = isDark ? "#0D0D0D" : "#F5F5F5";
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", color));

    return () => observer.disconnect();
  }, []);
  return null;
}

function AppWithSplash() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ThemeColorSync />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppWithSplash />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
