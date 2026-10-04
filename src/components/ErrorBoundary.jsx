import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-xl w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-8 space-y-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500 text-xl">
                ⚠️
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                  An unexpected error occurred. Please refresh the page.
                </p>
              </div>
            </div>

            <details className="text-xs text-muted-foreground bg-muted rounded-lg p-4 space-y-2 cursor-pointer">
              <summary className="font-semibold text-foreground cursor-pointer mb-2">
                Error Details (click to expand)
              </summary>
              <pre className="whitespace-pre-wrap break-all font-mono text-red-500">
                {this.state.error?.message || String(this.state.error)}
              </pre>
              {this.state.error?.stack && (
                <pre className="whitespace-pre-wrap break-all font-mono text-muted-foreground">
                  {this.state.error.stack}
                </pre>
              )}
              {this.state.info?.componentStack && (
                <pre className="whitespace-pre-wrap break-all font-mono text-muted-foreground">
                  {this.state.info.componentStack}
                </pre>
              )}
            </details>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
