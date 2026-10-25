import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changing this value (e.g. the current pathname) clears the error. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render errors so one broken page doesn't blank the whole app.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            This page hit an unexpected error. Your data is safe — try again, or head back to the dashboard.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button onClick={() => window.location.assign('/dashboard')}>Go to dashboard</Button>
          </div>
        </div>
      </div>
    );
  }
}
