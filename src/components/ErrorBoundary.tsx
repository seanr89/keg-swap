import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || '';
      const isChunkError =
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('Importing a module script failed') ||
        errorMessage.includes('error loading dynamically imported module') ||
        errorMessage.includes('dynamically imported module');

      return (
        <div className="error-boundary-card" role="alert" aria-live="assertive">
          <div className="error-boundary-icon-wrapper">
            <AlertTriangle className="error-boundary-icon" size={36} aria-hidden="true" />
          </div>
          <h2 className="error-boundary-title">
            {isChunkError ? 'App Update Available' : 'Something went wrong'}
          </h2>
          <p className="error-boundary-message">
            {isChunkError
              ? 'A newer version of Keg Swap has been deployed. Reload the page to load the updated screen and assets.'
              : 'An unexpected error occurred while displaying this view. You can reload the page or return to the events board.'}
          </p>
          <div className="error-boundary-actions">
            <button
              type="button"
              className="btn-primary error-boundary-btn"
              onClick={this.handleReload}
            >
              <RefreshCw size={16} aria-hidden="true" />
              <span>Reload Page</span>
            </button>
            {this.props.onReset && (
              <button
                type="button"
                className="btn-secondary error-boundary-btn"
                onClick={this.handleReset}
              >
                <Home size={16} aria-hidden="true" />
                <span>Return to Events</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
