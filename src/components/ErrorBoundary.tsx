import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  viewName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-3xl mx-auto my-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500/50 shadow-xl space-y-4">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-900/50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                Error Loading {this.props.viewName || 'Screen'}
              </h2>
              <p className="text-xs text-rose-600/80 dark:text-rose-300/80">
                An unexpected runtime crash occurred while rendering this component.
              </p>
            </div>
          </div>

          <div className="bg-rose-100/70 dark:bg-rose-900/30 rounded-2xl p-4 border border-rose-300 dark:border-rose-800 font-mono text-xs text-rose-900 dark:text-rose-200 overflow-x-auto whitespace-pre-wrap">
            <strong>Error:</strong> {this.state.error?.name}: {this.state.error?.message || 'Unknown error'}
            {this.state.error?.stack && (
              <div className="mt-2 text-[11px] opacity-80 max-h-48 overflow-y-auto">
                {this.state.error.stack}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
