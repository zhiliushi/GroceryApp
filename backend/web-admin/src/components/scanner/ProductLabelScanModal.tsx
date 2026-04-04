import { useState, useRef } from 'react';
import { useScanProductLabel } from '@/api/mutations/useScanMutations';
import { useLocations } from '@/api/queries/useLocations';
import { Link } from 'react-router-dom';
import { formatExpiry } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { LabelScanResult } from '@/types/api';

interface ProductLabelScanModalProps {
  onClose: () => void;
  onAddToInventory: (data: { name: string; brand: string; weight: number | null; weight_unit: string | null; expiry_date: string | null; barcode: string | null; location: string }) => void;
}

export default function ProductLabelScanModal({ onClose, onAddToInventory }: ProductLabelScanModalProps) {
  const [result, setResult] = useState<LabelScanResult | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [weight, setWeight] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState('g');
  const [expiryDate, setExpiryDate] = useState('');
  const [barcodeVal, setBarcodeVal] = useState('');
  const [location, setLocation] = useState('pantry');

  const inputRef = useRef<HTMLInputElement>(null);
  const scanMutation = useScanProductLabel();
  const { locations } = useLocations();

  const handleFile = async (file: File) => {
    try {
      const res = await scanMutation.mutateAsync(file);
      setResult(res);
      if (res.parsed) {
        if (res.parsed.name) setName(res.parsed.name);
        if (res.parsed.brand) setBrand(res.parsed.brand);
        if (res.parsed.weight) setWeight(String(res.parsed.weight));
        if (res.parsed.weight_unit) setWeightUnit(res.parsed.weight_unit);
        if (res.parsed.expiry_date) setExpiryDate(res.parsed.expiry_date);
        if (res.parsed.barcode) setBarcodeVal(res.parsed.barcode);
      }
    } catch {
      // error handled by mutation
    }
  };

  const handleAdd = () => {
    onAddToInventory({
      name, brand,
      weight: weight ? parseFloat(weight) : null,
      weight_unit: weight ? weightUnit : null,
      expiry_date: expiryDate || null,
      barcode: barcodeVal || null,
      location,
    });
    onClose();
  };

  const hasInventory = result?.inventory && result.inventory.total_in_stock > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <h2 className="text-lg font-semibold text-ga-text-primary">📷 Scan Product Label</h2>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Upload */}
          {!result && (
            <div>
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-ga-border hover:border-ga-accent/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                <div className="text-3xl mb-2">{scanMutation.isPending ? '⏳' : '📷'}</div>
                <p className="text-sm text-ga-text-primary">{scanMutation.isPending ? 'Processing...' : 'Tap to take photo of product label'}</p>
                <p className="text-xs text-ga-text-secondary mt-1">JPEG or PNG, max 5MB</p>
              </div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>
          )}

          {/* Scanned result banner */}
          {result && (
            <div className={cn('rounded-lg px-3 py-2 text-sm',
              result.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
            )}>
              {result.message}
            </div>
          )}

          {/* You already have */}
          {hasInventory && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-400 mb-1">You Already Have ({result!.inventory!.total_in_stock} in stock)</p>
              {result!.inventory!.items.slice(0, 3).map((item, i) => {
                const exp = formatExpiry(item.expiryDate ?? item.expiry_date);
                return (
                  <div key={i} className="text-xs text-ga-text-primary">
                    {item.location}: {item.quantity ?? 1} {item.unit || 'pcs'} <span className={exp.className}>{exp.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form (always editable) */}
          {(result || !scanMutation.isPending) && result && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">Product Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ga-text-secondary mb-1">Brand</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
                </div>
                <div>
                  <label className="block text-xs text-ga-text-secondary mb-1">Barcode</label>
                  <input value={barcodeVal} onChange={(e) => setBarcodeVal(e.target.value)}
                    className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-ga-text-secondary mb-1">Weight</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                    className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
                </div>
                <div>
                  <label className="block text-xs text-ga-text-secondary mb-1">Unit</label>
                  <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}
                    className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary">
                    {['g', 'kg', 'ml', 'L', 'oz', 'lb'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ga-text-secondary mb-1">Expiry</label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">Location</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary">
                  {locations.map((l) => <option key={l.key} value={l.key}>{l.icon} {l.name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleAdd} disabled={!name.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
                  Add to Inventory
                </button>
                {barcodeVal && (
                  <Link to={`/item/${barcodeVal}`} onClick={onClose}
                    className="text-xs text-ga-accent hover:underline">View History →</Link>
                )}
                <button onClick={() => { setResult(null); setName(''); setBrand(''); setWeight(''); setExpiryDate(''); setBarcodeVal(''); }}
                  className="text-xs text-ga-text-secondary hover:text-ga-text-primary">Scan Again</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
