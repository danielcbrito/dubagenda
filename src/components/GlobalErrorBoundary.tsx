import React, { Component, ReactNode } from "react";
import { InstabilityScreen } from "@/components/InstabilityScreen";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorType: "database" | "app";
}

/**
 * Error Boundary global que captura erros não tratados e exibe
 * a tela de instabilidade ao invés de uma tela branca.
 *
 * - Erros de banco/Supabase/fetch → 20 min
 * - Outros erros de app → 10 min
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorType: "app" };
  }

  static getDerivedStateFromError(error: Error): State {
    const msg = (error?.message || "").toLowerCase();

    // Only treat very specific database/supabase errors as DB errors
    const isDbError =
      msg.includes("supabase") ||
      msg.includes("postgres") ||
      msg.includes("pgrst") ||
      msg.includes("row level security") ||
      msg.includes("duplicate key") ||
      msg.includes("foreign key") ||
      msg.includes("failed to fetch");

    return {
      hasError: true,
      errorType: isDbError ? "database" : "app",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[GlobalErrorBoundary] Erro capturado:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorType: "app" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <InstabilityScreen
          errorType={this.state.errorType}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
