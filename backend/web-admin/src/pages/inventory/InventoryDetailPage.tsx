import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useInventoryItem } from '@/api/queries/useInventory';
import { useUpdateInventoryItem } from '@/api/mutations/useInventoryMutations';
import { useLocations } from '@/api/queries/useLocations';
import FormField from '@/components/shared/FormField';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ExpiryBar from '@/components/inventory/ExpiryBar';
import ItemActionBar from '@/components/inventory/ItemActionBar';
import ExpiryScanButton from '@/components/scanner/ExpiryScanButton';
import { formatDate, formatExpiry, formatCurrency, truncateUid } from '@/utils/format';
import { ITEM_STATUSES } from '@/utils/constants';
import { cn } from '@/utils/cn';

interface InventoryFormData {
  name: string;
  brand: string;
  barcode: string;
  category: string;
  status: string;
  storage_location: string;
  quantity: number | string;
  unit: string;
  price: number | string;
  expiry_date: string;
  purchase_date: string;
  needsReview: boolean;
  notes: string;
}

function tsToDateInput(ts: number | null | undefined): string {
  if (!ts) return '';
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toISOString().split('T')[0];
}

export default function InventoryDetailPage() {
  const { uid, itemId } = useParams<{ uid: string; itemId: string }>();
  const { data: item, isLoading } = useInventoryItem(uid!, itemId!);
  const updateMutation = useUpdateInventoryItem();
  const { locations, getLocation } = useLocations();
  const [isEditMode, setIsEditMode] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
  } = useForm<InventoryFormData>({ mode: 'onChange' });

  useEffect(() => {
    if (item) {
      reset({
        name: item.name || '',
        brand: item.brand || '',
        barcode: item.barcode || '',
        category: item.category || '',
        status: item.status || 'active',
        storage_location: item.storage_location || item.location || '',
        quantity: item.quantity ?? '',
        unit: item.unit || '',
        price: item.price ?? '',
        expiry_date: tsToDateInput(item.expiryDate ?? item.expiry_date),
        purchase_date: tsToDateInput(item.purchaseDate ?? item.purchase_date),
        needsReview: item.needsReview ?? false,
        notes: item.notes || '',
      });
    }
  }, [item, reset]);

  const onSubmit = async (data: InventoryFormData) => {
    if (!uid || !itemId) return;
    const payload: Record<string, unknown> = {
      ...data,
      quantity: data.quantity !== '' ? Number(data.quantity) : null,
      price: data.price !== '' ? Number(data.price) : null,
      expiry_date: data.expiry_date ? new Date(data.expiry_date).getTime() : null,
      purchase_date: data.purchase_date ? new Date(data.purchase_date).getTime() : null,
    };
    await updateMutation.mutateAsync({ uid, id: itemId, data: payload });
    setIsEditMode(false);
  };

  if (isLoading) return <LoadingSpinner text="Loading item..." />;
  if (!item) return <div className="p-6 text-ga-text-secondary">Item not found.</div>;

  const expiry = formatExpiry(item.expiryDate ?? item.expiry_date);
  const loc = getLocation(item.location || item.storage_location);

  return (
    <div className="p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1 text-sm">
        <Link to="/inventory" className="text-ga-accent hover:underline">Inventory</Link>
        {loc && (
          <>
            <span className="text-ga-text-secondary">/</span>
            <span className="text-ga-text-secondary">{loc.icon} {loc.name}</span>
          </>
        )}
        <span className="text-ga-text-secondary">/</span>
        <span className="text-ga-text-primary">{item.name}</span>
      </div>

      {/* Item Header Card */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-ga-text-primary">{item.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-ga-text-secondary">
              {item.brand && <span>{item.brand}</span>}
              {item.category && <><span>·</span><span>{item.category}</span></>}
              {loc && <><span>·</span><span>{loc.icon} {loc.name}</span></>}
            </div>
            {item.barcode && (
              <code className="text-xs font-mono text-ga-text-secondary mt-1 block">{item.barcode}</code>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                'text-sm font-medium rounded-md px-3 py-1.5 transition-colors',
                isEditMode
                  ? 'border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover'
                  : 'bg-ga-accent hover:bg-ga-accent/90 text-white',
              )}
            >
              {isEditMode ? 'Cancel' : '✏️ Edit'}
            </button>
          </div>
        </div>

        {/* Expiry bar */}
        <ExpiryBar
          purchaseDate={item.purchaseDate ?? item.purchase_date}
          addedDate={item.addedDate}
          expiryDate={item.expiryDate ?? item.expiry_date}
          className="mb-3"
        />

        {/* Action bar (data-driven) */}
        <ItemActionBar item={item} uid={uid!} />
      </div>

      {/* Edit form or detail view */}
      {isEditMode ? (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Name" name="name" register={register} errors={errors} required />
              <FormField label="Brand" name="brand" register={register} errors={errors} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Barcode" name="barcode" register={register} errors={errors} />
              <FormField label="Category" name="category" register={register} errors={errors} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">Status</label>
                <select
                  {...register('status')}
                  className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
                >
                  {ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">Location</label>
                <select
                  {...register('storage_location')}
                  className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
                >
                  <option value="">None</option>
                  {locations.map((l) => (
                    <option key={l.key} value={l.key}>{l.icon} {l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Quantity" name="quantity" type="number" register={register} errors={errors} />
              <FormField label="Unit" name="unit" register={register} errors={errors} placeholder="e.g. pcs, kg" />
              <FormField label="Price (RM)" name="price" type="number" register={register} errors={errors} rules={{ min: 0 }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Expiry Date" name="expiry_date" type="date" register={register} errors={errors} />
              <FormField label="Purchase Date" name="purchase_date" type="date" register={register} errors={errors} />
            </div>
            <FormField label="Notes" name="notes" register={register} errors={errors} rows={3} />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className="px-4 py-2 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-md px-4 py-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Quantity" value={item.quantity != null ? `${item.quantity} ${item.unit || ''}`.trim() : null} />
            <Field label="Price" value={formatCurrency(item.price)} />
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-1">Expiry</span>
              <div className="flex items-center gap-2">
                <span className={expiry.className}>{expiry.text}</span>
                <ExpiryScanButton onDateDetected={(d) => {
                  updateMutation.mutate({ uid: uid!, id: itemId!, data: { expiry_date: new Date(d).getTime(), expiryDate: new Date(d).getTime(), expiry_past: false } });
                }} />
              </div>
            </div>
            <Field label="Purchase Date" value={formatDate(item.purchaseDate ?? item.purchase_date)} />
            <Field label="Added" value={formatDate(item.addedDate)} />
            <Field label="Owner" value={truncateUid(item.user_id)} mono />
            {item.notes && (
              <div className="col-span-2">
                <span className="block text-xs font-medium text-ga-text-secondary mb-1">Notes</span>
                <span className="text-sm text-ga-text-primary">{item.notes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View full history link */}
      {item.barcode && (
        <div className="mt-4">
          <Link to={`/item/${item.barcode}`} className="text-sm text-ga-accent hover:underline">
            View full history for this product →
          </Link>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-ga-text-secondary mb-1">{label}</span>
      <span className={cn('text-sm text-ga-text-primary', mono && 'font-mono text-xs')}>
        {value || '—'}
      </span>
    </div>
  );
}
