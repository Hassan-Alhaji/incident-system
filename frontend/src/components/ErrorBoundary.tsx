import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  error?: Error;
  isChunkError?: boolean;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('text/html') ||
      error?.message?.includes('dynamically imported module');

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);

    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('text/html') ||
      error?.message?.includes('dynamically imported module');

    if (isChunkError) {
      const lastReload = parseInt(sessionStorage.getItem('last_error_boundary_reload') || '0', 10);
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem('last_error_boundary_reload', Date.now().toString());
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined, isChunkError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isChunk = this.state.isChunkError;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-red-200 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {isChunk ? 'تم تحديث النظام / System Updated' : 'حدث خطأ غير متوقع'}
          </h2>
          <p className="text-slate-500 text-sm mb-2">
            {isChunk
              ? 'يرجى إعادة تحميل الصفحة للحصول على آخر التحديثات'
              : 'Something went wrong'}
          </p>
          {this.state.error?.message && !isChunk && (
            <p className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2 my-4 text-slate-600 text-left dir-ltr break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-600/30 mt-3"
          >
            <RefreshCw size={15} />
            إعادة تحميل / Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
