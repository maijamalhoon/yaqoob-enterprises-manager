import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />,
          error: <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />,
          warning: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />,
          info: <Info className="h-5 w-5 text-cyan-400 shrink-0" />,
        };

        const borders = {
          success: 'border-emerald-800/80 bg-slate-900/95 shadow-emerald-950/20',
          error: 'border-rose-800/80 bg-slate-900/95 shadow-rose-950/20',
          warning: 'border-amber-800/80 bg-slate-900/95 shadow-amber-950/20',
          info: 'border-cyan-800/80 bg-slate-900/95 shadow-cyan-950/20',
        };

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-bottom-3',
              borders[toast.type]
            )}
          >
            {icons[toast.type]}
            <div className="flex-1 text-left">
              <h4 className="text-xs font-semibold text-slate-100">{toast.title}</h4>
              {toast.message && (
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
