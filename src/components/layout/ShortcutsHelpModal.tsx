import React from 'react';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';

export const ShortcutsHelpModal: React.FC = () => {
  const { isShortcutsHelpOpen, setIsShortcutsHelpOpen } = useApp();

  const shortcuts = [
    { key: 'Ctrl + K', desc: 'Open Command Palette & Global Search' },
    { key: 'Ctrl + N', desc: 'New Quick Sale (POS Terminal Mode)' },
    { key: 'Ctrl + Shift + E', desc: 'Record Quick Shop Expense' },
    { key: 'F2', desc: 'Focus POS Barcode / Search Input' },
    { key: 'Ctrl + Enter', desc: 'Proceed to Payment / Submit Active Form' },
    { key: 'Escape', desc: 'Close open dialog, clear selection or modal' },
  ];

  return (
    <Modal
      isOpen={isShortcutsHelpOpen}
      onClose={() => setIsShortcutsHelpOpen(false)}
      title="Keyboard Shortcuts"
      description="Desktop-optimized shortcuts designed for rapid 8-hour cashier workflows."
      maxWidth="md"
    >
      <div className="space-y-2.5 py-2">
        {shortcuts.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between p-2.5 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec]"
          >
            <span className="text-xs text-[#243b53] font-medium">{s.desc}</span>
            <kbd className="px-2 py-1 text-xs font-mono font-semibold text-teal-800 bg-white border border-[#d9e2ec] rounded-[6px] shadow-xs">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
};
