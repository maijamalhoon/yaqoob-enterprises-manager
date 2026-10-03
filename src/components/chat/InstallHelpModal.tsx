import React from 'react';
import { Smartphone, Monitor, Apple, Check, X } from 'lucide-react';

interface InstallHelpModalProps {
  onClose: () => void;
}

export const InstallHelpModal: React.FC<InstallHelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 text-base">Install Yaqoob Ledger</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-gray-700">
          <p className="text-gray-600 text-xs leading-relaxed">
            Install this application on your phone or PC for lightning-fast 1-tap access, offline recording, and full-screen experience.
          </p>

          {/* Android Guide */}
          <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Android (Google Chrome)</span>
            </div>
            <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1 pl-1">
              <li>Tap the three dots (⋮) menu in Chrome top-right.</li>
              <li>Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li>
              <li>Confirm install. The icon appears on your home screen!</li>
            </ol>
          </div>

          {/* iPhone Guide */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-blue-900">
              <Apple className="w-4 h-4 text-blue-600" />
              <span>iPhone / iPad (Apple Safari)</span>
            </div>
            <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
              ⚠️ iPhone users: Safari requires adding to Home Screen for offline caching & full-screen mode!
            </div>
            <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1 pl-1">
              <li>Open this site in <strong>Safari</strong>.</li>
              <li>Tap the <strong>Share</strong> button (box with upward arrow) at the bottom.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> at top right.</li>
            </ol>
          </div>

          {/* PC Guide */}
          <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Monitor className="w-4 h-4 text-indigo-600" />
              <span>PC / Laptop (Chrome / Edge)</span>
            </div>
            <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1 pl-1">
              <li>Look at the right side of the address bar.</li>
              <li>Click the <strong>Install</strong> computer icon.</li>
              <li>The ledger opens in its own fast desktop window.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
