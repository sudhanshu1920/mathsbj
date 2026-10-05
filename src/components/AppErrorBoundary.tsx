import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the failure visible to developers without leaking details to users.
    if (import.meta.env.DEV) {
      console.error("[app] render failure", error, info.componentStack);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background px-6 py-10 text-foreground flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
          <h1 className="font-display text-xl font-black">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app hit an unexpected screen error. Reload to restore the application.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 w-full rounded-xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
