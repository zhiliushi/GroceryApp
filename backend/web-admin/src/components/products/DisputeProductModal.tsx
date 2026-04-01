import { useState, useEffect } from 'react';
import { useSubmitDispute } from '@/api/mutations/useProductMutations';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { ProductDispute } from '@/types/api';

const DISPUTE_TYPES = [
  { value: 'wrong_name', label: 'Wrong product name' },
  { value: 'wrong_brand', label: 'Wrong brand' },
  { value: 'wrong_category', label: 'Wrong category' },
  { value: 'other', label: 'Other' },
] as const;

interface DisputeProductModalProps {
  barcode: string;
  currentName: string | null;
  onClose: () => void;
}

export default function DisputeProductModal({ barcode, currentName, onClose }: DisputeProductModalProps) {
  const [type, setType] = useState('wrong_name');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [existingDispute, setExistingDispute] = useState<ProductDispute | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const user = useAuthStore((s) => s.user);
  const mutation = useSubmitDispute();

  // Check for existing dispute by this user
  useEffect(() => {
    if (!user?.uid) { setLoadingExisting(false); return; }
    apiClient.get(API.DISPUTE_MY(barcode), { params: { user_id: user.uid } })
      .then((r) => {
        const d = r.data.dispute;
        if (d) {
          setExistingDispute(d);
          setType(d.type);
          setSuggestedValue(d.suggested_value || '');
          setNotes(d.notes || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, [barcode, user?.uid]);

  const handleSubmit = () => {
    if (!suggestedValue.trim()) return;
    mutation.mutate(
      {
        barcode,
        type,
        current_value: currentName || '',
        suggested_value: suggestedValue.trim(),
        notes: notes.trim(),
        submitted_by: user?.uid || 'anonymous',
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <h2 className="text-lg font-semibold text-ga-text-primary">Report Issue with Product</h2>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {loadingExisting ? (
            <div className="text-center py-4 text-sm text-ga-text-secondary">Checking for existing reports...</div>
          ) : (
            <>
              {existingDispute && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-xs text-blue-400">
                  You reported this on {new Date(existingDispute.submitted_at).toLocaleDateString()}.
                  Edit your report below.
                </div>
              )}

              <div className="text-xs text-ga-text-secondary">
                Barcode: <code className="font-mono">{barcode}</code>
                {currentName && <span className="block mt-0.5">Current name: "{currentName}"</span>}
              </div>

              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">What's wrong?</label>
                <div className="space-y-1.5">
                  {DISPUTE_TYPES.map((dt) => (
                    <label key={dt.value} className="flex items-center gap-2 text-sm text-ga-text-primary cursor-pointer">
                      <input type="radio" name="type" value={dt.value} checked={type === dt.value}
                        onChange={(e) => setType(e.target.value)} className="accent-ga-accent" />
                      {dt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">Correct value *</label>
                <input value={suggestedValue} onChange={(e) => setSuggestedValue(e.target.value)}
                  placeholder="Enter the correct value..."
                  className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
              </div>

              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">Additional notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Any extra context..."
                  className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary resize-none" />
              </div>

              <p className="text-xs text-ga-text-secondary">An admin will review and update if correct.</p>

              <div className="flex gap-2 justify-end">
                <button onClick={onClose} className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2">Cancel</button>
                <button onClick={handleSubmit} disabled={!suggestedValue.trim() || mutation.isPending}
                  className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
                  {mutation.isPending ? 'Submitting...' : existingDispute ? 'Update Report' : 'Submit Dispute'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
