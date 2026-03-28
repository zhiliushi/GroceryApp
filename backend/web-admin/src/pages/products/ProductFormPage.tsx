import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useProduct } from '@/api/queries/useProducts';
import { useCreateProduct, useUpdateProduct, useLookupBarcode } from '@/api/mutations/useProductMutations';
import FormField from '@/components/shared/FormField';
import ImagePreview from '@/components/shared/ImagePreview';

interface ProductFormData {
  barcode: string;
  product_name: string;
  brands: string;
  categories: string;
  image_url: string;
}

export default function ProductFormPage() {
  const { barcode } = useParams<{ barcode: string }>();
  const isEdit = !!barcode;
  const navigate = useNavigate();

  const { data: existing } = useProduct(barcode);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const lookupMutation = useLookupBarcode();

  const [lookupStatus, setLookupStatus] = useState<'idle' | 'found' | 'not_found'>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<ProductFormData>({ mode: 'onChange' });

  const imageUrl = watch('image_url');

  // Populate form in edit mode
  useEffect(() => {
    if (existing) {
      reset({
        barcode: existing.barcode,
        product_name: existing.product_name || '',
        brands: existing.brands || '',
        categories: existing.categories || '',
        image_url: existing.image_url || '',
      });
    }
  }, [existing, reset]);

  const handleLookup = async () => {
    const bc = watch('barcode');
    if (!bc) return;
    setLookupStatus('idle');
    try {
      const result = await lookupMutation.mutateAsync(bc);
      setValue('product_name', result.product_name || '', { shouldValidate: true });
      setValue('brands', result.brands || '');
      setValue('categories', result.categories || '');
      setValue('image_url', result.image_url || '');
      setLookupStatus('found');
    } catch {
      setLookupStatus('not_found');
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    if (isEdit) {
      await updateMutation.mutateAsync({ barcode: barcode!, data: data as unknown as Record<string, unknown> });
    } else {
      await createMutation.mutateAsync(data as unknown as Record<string, unknown>);
    }
    navigate('/products');
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/products" className="text-ga-accent hover:underline text-sm">
          ← Products
        </Link>
        <span className="text-ga-text-secondary text-sm mx-2">/</span>
        <span className="text-ga-text-primary text-sm">
          {isEdit ? `Edit "${existing?.product_name || barcode}"` : 'Add Product'}
        </span>
      </div>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Barcode + Lookup */}
          <div className="flex gap-3 items-end">
            <FormField
              label="Barcode"
              name="barcode"
              register={register}
              errors={errors}
              required
              placeholder="Enter barcode"
              readOnly={isEdit}
              className="flex-1"
            />
            {!isEdit && (
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookupMutation.isPending}
                className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-3 py-2 transition-colors disabled:opacity-50 whitespace-nowrap h-[38px]"
              >
                {lookupMutation.isPending ? '...' : '🔍 Lookup'}
              </button>
            )}
          </div>

          {/* Lookup status */}
          {lookupStatus === 'found' && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-md px-3 py-2 text-sm">
              Found on Open Food Facts — fields pre-filled
            </div>
          )}
          {lookupStatus === 'not_found' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-md px-3 py-2 text-sm">
              Not found on Open Food Facts — enter details manually
            </div>
          )}

          <FormField
            label="Product Name"
            name="product_name"
            register={register}
            errors={errors}
            required
            placeholder="Enter product name"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Brands"
              name="brands"
              register={register}
              errors={errors}
              placeholder="e.g. Nestle"
            />
            <FormField
              label="Categories"
              name="categories"
              register={register}
              errors={errors}
              placeholder="e.g. Beverages"
            />
          </div>

          <FormField
            label="Image URL"
            name="image_url"
            register={register}
            errors={errors}
            placeholder="https://..."
          />

          <ImagePreview src={imageUrl} variant="form" />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              to="/products"
              className="px-4 py-2 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
