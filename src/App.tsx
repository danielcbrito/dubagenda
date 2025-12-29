import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Barber from "./pages/Barber";
import Admin from "./pages/Admin";
import AdminRelatoriosMensais from "./pages/AdminRelatoriosMensais";
import AgendaFullScreen from "./pages/AgendaFullScreen";
import SupportChat from "./pages/SupportChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/barbeiro/*" element={<Barber />} />
          <Route path="/suporte" element={<SupportChat />} />
          <Route path="/agenda-fullscreen" element={<AgendaFullScreen />} />
          <Route path="/admin/relatorios-mensais" element={<AdminRelatoriosMensais />} />
          <Route path="/admin/*" element={<Admin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
