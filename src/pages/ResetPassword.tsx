import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para a nova tela unificada de recuperação via WhatsApp
    navigate("/esqueci-senha", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground">Redirecionando para recuperação via WhatsApp...</p>
    </div>
  );
};

export default ResetPassword;