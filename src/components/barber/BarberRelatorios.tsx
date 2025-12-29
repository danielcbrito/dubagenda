import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface BarberRelatoriosProps {
  barbeiroId: string;
}

/**
 * BarberRelatorios - Componente de redirecionamento
 * 
 * Redireciona automaticamente para a página de relatórios mensais do barbeiro.
 */
export function BarberRelatorios({ barbeiroId }: BarberRelatoriosProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para a página de relatórios mensais do barbeiro
    navigate('/barbeiro/relatorios-mensais', { replace: true });
  }, [navigate]);

  return null;
}