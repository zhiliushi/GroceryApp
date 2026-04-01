import { useState } from 'react';
import { useContributeProduct } from '@/api/mutations/useBarcodeMutations';
import { useAuthStore } from '@/stores/authStore';

interface ContributeProductFormProps {
  barcode: string;
  onContributed: (name: string) => void;
  onCancel: () => void;
}

export default function ContributeProductForm({
  barcode,
  onContributed,
  onCancel,
}: ContributeProductFormProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const user = useAuthStore((s) => s.user);
  const mutation = useContributeProduct();

  const handleSubmit = () => {
    if (name.trim().length < 2) return;
    mutation.mutate(
      {
        barcode,
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        contributed_by: user?.uid,
      },
      { onSuccess: () => onContributed(name.trim()) },
    );
  };

  return (
    <div className="bg-ga-bg-hover border border-ga-border rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium text-ga-text-primary">
        Contribute Product Info
      </h4>
      <p className="text-xs text-ga-text-secondary">
        Barcode <code className="font-mono">{barcode}</code> isn't in our database. Help by adding it!
      </p>

      <div>
        <label className="block text-xs text-ga-text-secondary mb-1">Product Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 4INI Choco Wafer"
          className="w-full bg-ga-bg-card border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Brand</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Munchy's"
            className="w-full bg-ga-bg-card border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Snacks"
            className="w-full bg-ga-bg-card border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
          />
        </div>
      </div>

      {mutation.error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">
          {mutation.error.message}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={name.trim().length < 2 || mutation.isPending}
          className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          {mutation.isPending ? 'Submitting...' : 'Submit'}
        </button>
        <button
          onClick={onCancel}
          className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2 hover:text-ga-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
