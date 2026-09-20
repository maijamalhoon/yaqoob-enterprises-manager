import React from "react";
import { useApp } from "../../context/AppContext";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="h-5 w-5 text-[#16a34a] shrink-0" />,
          error: <AlertCircle className="h-5 w-5 text-[#dc2626] shrink-0" />,
          warning: <AlertTriangle className="h-5 w-5 text-[#d97706] shrink-0" />,
          info: <Info className="h-5 w-5 text-[#4f46e5] shrink-0" />,
        };

        const borders = {
          success: "border-[#dcfce7] bg-white text-[#14181f]",
          error: "border-[#fee2e2] bg-white text-[#14181f]",
          warning: "border-[#fef3c7] bg-white text-[#14181f]",
          info: "border-[#c7d2fe] bg-white text-[#14181f]",
        };

        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] bg-white transition-all animate-in slide-in-from-bottom-3",
              borders[toast.type],
            )}
          >
            {icons[toast.type]}
            <div className="flex-1 text-left">
              <h4 className="text-xs font-semibold text-[#14181f]">{toast.title}</h4>
              {toast.message && (
                <p className="text-xs text-[#667085] mt-0.5 leading-relaxed">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#667085] hover:text-[#14181f] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
