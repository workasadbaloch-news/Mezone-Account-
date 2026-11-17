import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Mezone application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let readableMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && typeof parsed.error === 'string') {
          readableMessage = `${parsed.error} (operation: ${parsed.operationType}, path: ${parsed.path ?? 'unknown'})`;
        }
      } catch {
        // Not JSON, keep plain error message
      }

      return (
        <div className="min-h-screen bg-[#FAF9F6] text-[#111113] flex items-center justify-center px-6 py-12">
          <div className="max-w-lg w-full bg-white border border-black/10 rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-3 text-[#C2410C] mb-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h1 className="text-lg font-semibold">Something went wrong</h1>
            </div>
            <p className="text-sm text-[#57534E] leading-relaxed mb-6 break-words">
              {readableMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111113] text-white text-sm font-medium rounded-lg hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Return to Mezone Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
