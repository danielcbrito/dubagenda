import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * AdminRelatorios - Componente de redirecionamento
 * 
 * Redireciona automaticamente para a página de relatórios mensais.
 * A seção "Relatórios" do menu agora aponta diretamente para os relatórios mensais.
 */
export function AdminRelatorios() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para a página de relatórios mensais
    navigate('/admin/relatorios-mensais', { replace: true });
  }, [navigate]);

  return null;
}
