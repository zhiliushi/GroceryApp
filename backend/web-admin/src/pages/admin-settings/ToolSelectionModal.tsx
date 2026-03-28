import { useState, useEffect } from 'react';
import type { User } from '@/types/api';

const TOOL_MENU = [
  { key: 'cloud_sync_multi_device', label: 'Cloud Sync + Multi-Device', icon: '☁️' },
  { key: 'price_tracking', label: 'Price Tracking', icon: '💰' },
  { key: 'checkout_flow', label: 'Checkout Flow', icon: '🛒' },
  { key: 'basic_analytics', label: 'Basic Analytics', icon: '📊' },
  { key: 'advanced_analytics', label: 'Advanced Analytics', icon: '📈' },
  { key: 'price_comparison', label: 'Price Comparison', icon: '⚖️' },
  { key: 'export', label: 'Data Export', icon: '📤' },
  { key: 'receipt_scanning_ocr', label: 'Receipt Scanning (OCR)', icon: '🧾' },
];

const MAX_TOOLS = 3;

interface ToolSelectionModalProps {
  user: User;
  onSave: (tools: string[]) => void;
  onClose: () => void;
  isSaving: boolean;
}

export default function ToolSelectionModal({ user, onSave, onClose, isSaving }: ToolSelectionModalProps) {
  const [selected, setSelected] = useState<string[]>(user.selected_tools || []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const toggleTool = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_TOOLS) return prev;
      return [...prev, key];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-sm font-semibold text-ga-text-primary">
            Smart Cart Tools — {user.email || user.uid}
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            Select {MAX_TOOLS} tools ({selected.length}/{MAX_TOOLS} selected)
          </p>
        </div>

        <div className="px-5 py-4 space-y-2">
          {TOOL_MENU.map((tool) => {
            const isSelected = selected.includes(tool.key);
            const isDisabled = !isSelected && selected.length >= MAX_TOOLS;

            return (
              <label
                key={tool.key}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-ga-accent bg-ga-accent/10'
                    : isDisabled
                    ? 'border-ga-border/50 opacity-40 cursor-not-allowed'
                    : 'border-ga-border hover:bg-ga-bg-hover'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => toggleTool(tool.key)}
                  className="rounded border-ga-border accent-ga-accent"
                />
                <span className="text-base">{tool.icon}</span>
                <span className="text-sm text-ga-text-primary">{tool.label}</span>
              </label>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(selected)}
            disabled={isSaving || selected.length !== MAX_TOOLS}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : `Save (${selected.length}/${MAX_TOOLS})`}
          </button>
        </div>
      </div>
    </div>
  );
}
