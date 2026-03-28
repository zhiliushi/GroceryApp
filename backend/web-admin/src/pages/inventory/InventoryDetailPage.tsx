import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useInventoryItem } from '@/api/queries/useInventory';
import { useUpdateInventoryItem } from '@/api/mutations/useInventoryMutations';
import FormField from '@/components/shared/FormField';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { formatDate, formatExpiry, formatCurrency, truncateUid } from '@/utils/format';
import { ITEM_STATUSES, STORAGE_LOCATIONS } from '@/utils/constants';
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

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/inventory" className="text-ga-accent hover:underline text-sm">
          ← Inventory
        </Link>
        <span className="text-ga-text-secondary text-sm mx-2">/</span>
        <span className="text-ga-text-primary text-sm">{item.name}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-ga-text-primary">{item.name}</h1>
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className={cn(
            'text-sm font-medium rounded-md px-3 py-1.5 transition-colors',
            isEditMode
              ? 'border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover'
              : 'bg-ga-accent hover:bg-ga-accent-hover text-white',
          )}
        >
          {isEditMode ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {isEditMode ? (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 max-w-3xl">
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
                <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">
                  Status<span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  {...register('status', { required: 'Status is required' })}
                  className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
                >
                  {ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">
                  Storage Location
                </label>
                <select
                  {...register('storage_location')}
                  className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
                >
                  <option value="">None</option>
                  {STORAGE_LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </option>
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="needsReview"
                {...register('needsReview')}
                className="rounded border-ga-border accent-ga-accent"
              />
              <label htmlFor="needsReview" className="text-sm text-ga-text-secondary">
                Needs Review
              </label>
            </div>
            <FormField label="Notes" name="notes" register={register} errors={errors} rows={3} />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className="px-4 py-2 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 max-w-3xl">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Name" value={item.name} />
            <Field label="Brand" value={item.brand} />
            <Field label="Barcode" value={item.barcode} mono />
            <Field label="Category" value={item.category} />
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-1">Status</span>
              <StatusBadge status={item.status} />
            </div>
            <Field label="Location" value={item.storage_location || item.location} capitalize />
            <Field label="Quantity" value={item.quantity != null ? `${item.quantity} ${item.unit || ''}`.trim() : null} />
            <Field label="Price" value={formatCurrency(item.price)} />
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-1">Expiry</span>
              <span className={expiry.className}>{expiry.text}</span>
            </div>
            <Field label="Purchase Date" value={formatDate(item.purchaseDate ?? item.purchase_date)} />
            <Field label="Owner" value={truncateUid(item.user_id)} mono />
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-1">Needs Review</span>
              <span className={item.needsReview ? 'text-yellow-400' : 'text-ga-text-secondary'}>
                {item.needsReview ? 'Yes' : 'No'}
              </span>
            </div>
            {item.notes && (
              <div className="col-span-2">
                <span className="block text-xs font-medium text-ga-text-secondary mb-1">Notes</span>
                <span className="text-sm text-ga-text-primary">{item.notes}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  capitalize: cap,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-ga-text-secondary mb-1">{label}</span>
      <span
        className={cn(
          'text-sm text-ga-text-primary',
          mono && 'font-mono text-xs',
          cap && 'capitalize',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}
