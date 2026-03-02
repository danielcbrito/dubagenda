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
    const stack = (error?.stack || "").toLowerCase();
    const combined = msg + " " + stack;

    const isDbError =
      combined.includes("supabase") ||
      combined.includes("postgres") ||
      combined.includes("database") ||
      combined.includes("rls") ||
      combined.includes("row level security") ||
      combined.includes("pgrst") ||
      combined.includes("42") || // postgres error codes
      combined.includes("relation") ||
      combined.includes("violates") ||
      combined.includes("duplicate key") ||
      combined.includes("foreign key") ||
      combined.includes("timeout") ||
      combined.includes("network") ||
      combined.includes("fetch") ||
      combined.includes("failed to fetch") ||
      combined.includes("networkerror") ||
      combined.includes("connection");

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
