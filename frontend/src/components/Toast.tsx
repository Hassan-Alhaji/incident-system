import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error:   <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info:    <Info size={18} />,
};

const STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'bg-emerald-50',  border: 'border-emerald-300', text: 'text-emerald-800', icon: 'text-emerald-500' },
  error:   { bg: 'bg-red-50',      border: 'border-red-300',     text: 'text-red-800',     icon: 'text-red-500'     },
  warning: { bg: 'bg-amber-50',    border: 'border-amber-300',   text: 'text-amber-800',   icon: 'text-amber-500'   },
  info:    { bg: 'bg-blue-50',     border: 'border-blue-300',    text: 'text-blue-800',    icon: 'text-blue-500'    },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // keep max 5

    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container — fixed top-center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-full max-w-md px-4">
        {toasts.map((toast) => {
          const style = STYLES[toast.type];
          return (
            <div
              key={toast.id}
              className={`
                pointer-events-auto w-full flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm
                ${style.bg} ${style.border}
                transition-all duration-300 ease-out
                ${toast.exiting
                  ? 'opacity-0 -translate-y-2 scale-95'
                  : 'opacity-100 translate-y-0 scale-100 animate-toast-in'
                }
              `}
            >
              <span className={`flex-shrink-0 mt-0.5 ${style.icon}`}>
                {ICONS[toast.type]}
              </span>
              <p className={`flex-1 text-sm font-semibold leading-relaxed ${style.text}`}>
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className={`flex-shrink-0 p-0.5 rounded-md hover:bg-black/5 transition-colors ${style.text} opacity-60 hover:opacity-100`}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Keyframe animation injected via style tag */}
      <style>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-toast-in {
          animation: toast-in 0.3s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
};
