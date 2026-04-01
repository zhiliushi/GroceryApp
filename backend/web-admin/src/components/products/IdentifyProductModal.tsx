import { useState } from 'react';
import { useCreateProduct } from '@/api/mutations/useProductMutations';
import { useContributeProduct } from '@/api/mutations/useBarcodeMutations';
import { useAuthStore } from '@/stores/authStore';

interface IdentifyProductModalProps {
  barcode: string;
  onClose: () => void;
  onIdentified: () => void;
}

export default function IdentifyProductModal({ barcode, onClose, onIdentified }: IdentifyProductModalProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const { isAdmin, user } = useAuthStore();
  const createMutation = useCreateProduct();
  const contributeMutation = useContributeProduct();

  const handleSubmit = () => {
    if (name.trim().length < 2) return;

    if (isAdmin) {
      createMutation.mutate(
        { barcode, product_name: name.trim(), brands: brand.trim(), categories: category.trim(), source: 'manual' },
        { onSuccess: () => { onIdentified(); onClose(); } },
      );
    } else {
      contributeMutation.mutate(
        { barcode, name: name.trim(), brand: brand.trim() || undefined, category: category.trim() || undefined, contributed_by: user?.uid },
        { onSuccess: () => { onIdentified(); onClose(); } },
      );
    }
  };

  const isPending = createMutation.isPending || contributeMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <h2 className="text-lg font-semibold text-ga-text-primary">Help Identify This Product</h2>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-ga-text-secondary">
            Barcode: <code className="font-mono">{barcode}</code>
          </p>

          <div>
            <label className="block text-xs text-ga-text-secondary mb-1">Product Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
              placeholder="e.g. 4INI Choco Wafer"
              className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Brand (optional)</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Munchy's"
                className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
            </div>
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Category (optional)</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Snacks"
                className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
            </div>
          </div>

          <div className="bg-ga-bg-hover rounded-lg p-3 text-xs text-ga-text-secondary">
            We don't currently store images to save resources. Text-only contributions accepted.
            {!isAdmin && (
              <span className="block mt-1">Your contribution will be reviewed by an admin before it appears in the database.</span>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2 hover:text-ga-text-primary">Cancel</button>
            <button onClick={handleSubmit} disabled={name.trim().length < 2 || isPending}
              className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
              {isPending ? 'Saving...' : isAdmin ? 'Save Product' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
