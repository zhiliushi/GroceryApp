import { useState, useEffect, useRef } from 'react';
import type { TierDefinition } from '@/types/api';

interface TierEditModalProps {
  tier: TierDefinition;
  onSave: (updated: TierDefinition) => void;
  onClose: () => void;
  isSaving: boolean;
}

export default function TierEditModal({ tier, onSave, onClose, isSaving }: TierEditModalProps) {
  const [form, setForm] = useState<TierDefinition>(tier);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const update = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLimit = (field: string, value: string) => {
    const num = value === '' ? 0 : parseInt(value, 10);
    setForm((prev) => ({ ...prev, limits: { ...prev.limits, [field]: isNaN(num) ? 0 : num } }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ga-text-primary">Edit: {tier.name}</h3>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-lg">×</button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-ga-text-secondary mb-1">Name</label>
            <input
              ref={nameRef}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ga-text-secondary mb-1">Price</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => update('price', parseFloat(e.target.value) || 0)}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ga-text-secondary mb-1">Billing</label>
              <select
                value={form.billing || ''}
                onChange={(e) => update('billing', e.target.value || null)}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
              >
                <option value="">None (Free)</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-semibold uppercase text-ga-text-secondary mt-2">Limits (-1 = Unlimited)</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Max Items</label>
              <input type="number" value={form.limits.max_items} onChange={(e) => updateLimit('max_items', e.target.value)}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent" />
            </div>
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Max Lists</label>
              <input type="number" value={form.limits.max_lists} onChange={(e) => updateLimit('max_lists', e.target.value)}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent" />
            </div>
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Retention (days)</label>
              <input type="number" value={form.limits.data_retention_days} onChange={(e) => updateLimit('data_retention_days', e.target.value)}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent" />
            </div>
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Scans/Day</label>
              <input type="number" value={form.limits.max_scans_per_day} onChange={(e) => updateLimit('max_scans_per_day', e.target.value)}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ga-text-secondary mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
