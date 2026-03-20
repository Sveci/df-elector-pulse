import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary – catches unhandled React render errors and shows a
 * professional recovery screen instead of a blank white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info });
    // In production you could send to Sentry / LogRocket here:
    // captureException(error, { extra: info });
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => window.location.reload();
  handleHome = () => { window.location.href = "/dashboard"; };

  render() {
    if (this.props.fallback && this.state.hasError) {
      return this.props.fallback;
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Algo deu errado
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Ocorreu um erro inesperado. Nossa equipe foi notificada. Você
                pode tentar recarregar a página ou voltar ao início.
              </p>
            </div>

            {/* Error detail (dev only) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left text-xs bg-muted rounded-lg p-3 max-h-32 overflow-auto">
                <summary className="cursor-pointer font-medium text-muted-foreground mb-1">
                  Detalhes do erro
                </summary>
                <pre className="whitespace-pre-wrap break-all text-destructive">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleHome} className="gap-2">
                <Home className="h-4 w-4" />
                Ir ao início
              </Button>
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
