import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { MaintenanceWarningBanner } from "@/components/MaintenanceWarningBanner";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import EmailVerification from "./pages/EmailVerification";
import VerificarWhatsApp from "./pages/VerificarWhatsApp";
import EscolherVerificacao from "./pages/EscolherVerificacao";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Cliente from "./pages/Cliente";
import ClienteAgendar from "./pages/ClienteAgendar";
import ClienteAssinar from "./pages/ClienteAssinar";
import ClientePagamento from "./pages/ClientePagamento";
import ClientePixCheckout from "./pages/ClientePixCheckout";
import SubscriptionPixCheckout from "./pages/SubscriptionPixCheckout";
import ClienteCarteira from "./pages/ClienteCarteira";
import ClientePerfil from "./pages/ClientePerfil";
import ClienteDadosPessoais from "./pages/ClienteDadosPessoais";
import ClienteSeguranca from "./pages/ClienteSeguranca";
import SupportChat from "./pages/SupportChat";
import NotFound from "./pages/NotFound";
import BarberReviews from "./pages/BarberReviews";

const queryClient = new QueryClient();

// Routes that are always accessible (before login)
const PUBLIC_ROUTES = [
  '/',
  '/auth',
  '/auth/callback',
  '/verificar-email',
  '/verificar-whatsapp',
  '/escolher-verificacao',
  '/esqueci-senha',
  '/resetar-senha'
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
    location.pathname === route || location.pathname.startsWith('/auth')
  );

  // If still loading, show nothing (to avoid flash)
  if (isLoading) {
    return null;
  }

  // Public routes (login, signup, etc.) are always accessible
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Allowed users can access everything
  if (isAllowedUser) {
    return (
      <div className="flex flex-col min-h-dvh">
        {warningActive && warningMessage && (
          <MaintenanceWarningBanner message={warningMessage} />
        )}
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

  // Normal flow - show warning banner if active
  return (
    <div className="flex flex-col min-h-dvh">
      {warningActive && warningMessage && (
        <MaintenanceWarningBanner message={warningMessage} />
      )}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}

/**
 * Limpa sessões inválidas automaticamente para evitar loops de erro
 */
function AuthSessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed successfully');
      }
      if (event === 'SIGNED_OUT') {
        console.log('[Auth] User signed out');
      }
    });

    // Verificar sessão inicial e limpar se inválida
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        console.warn('[Auth] Sessão inválida detectada, limpando...', error.message);
        supabase.auth.signOut().then(() => {
          if (!PUBLIC_ROUTES.some(r => location.pathname === r || location.pathname.startsWith('/auth'))) {
            navigate('/auth?mode=login');
          }
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AuthSessionGuard>
      <MaintenanceWrapper>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/verificar-email" element={<EmailVerification />} />
          <Route path="/verificar-whatsapp" element={<VerificarWhatsApp />} />
          <Route path="/escolher-verificacao" element={<EscolherVerificacao />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/resetar-senha" element={<ResetPassword />} />
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
          <Route path="/cliente/barbeiro/:barberId/avaliacoes" element={<BarberReviews />} />
          <Route path="/suporte" element={<SupportChat />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MaintenanceWrapper>
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

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <ThemeColorSync />
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
