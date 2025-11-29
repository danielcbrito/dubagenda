import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logoDub from "@/assets/logo-dub.png";
import barbershopBg from "@/assets/barbershop-landing-bg.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Premium barbershop background */}
      <div className="absolute inset-0">
        <img 
          src={barbershopBg} 
          alt="" 
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
        {/* Logo */}
        <div className="mb-8">
          <img 
            src={logoDub} 
            alt="Barbearia DUB" 
            className="w-32 h-32 object-contain filter drop-shadow-2xl"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-semibold text-center mb-2 tracking-tight">
          Barbearia <span className="text-primary">DUB</span>
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-12 max-w-xs">
          Estilo premium. Atendimento exclusivo.
        </p>

        {/* Action buttons */}
        <div className="w-full max-w-sm space-y-4">
          <Button
            onClick={() => navigate("/auth?mode=signup")}
            className="w-full h-12 text-base bg-primary hover:bg-primary/90 shadow-lg"
          >
            Sou novo cliente
          </Button>
          
          <Button
            onClick={() => navigate("/auth?mode=login")}
            variant="outline"
            className="w-full h-12 text-base border-border hover:bg-secondary"
          >
            Já sou cliente
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 Barbearia DUB. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
