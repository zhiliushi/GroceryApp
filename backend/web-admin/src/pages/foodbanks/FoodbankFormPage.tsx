import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useFoodbank } from '@/api/queries/useFoodbanks';
import { useCreateFoodbank, useUpdateFoodbank } from '@/api/mutations/useFoodbankMutations';
import FormField from '@/components/shared/FormField';
import { FOODBANK_COUNTRIES } from '@/utils/constants';

interface FoodbankFormData {
  name: string;
  country: string;
  state: string;
  description: string;
  location_name: string;
  location_address: string;
  location_link: string;
  latitude: string;
  longitude: string;
  source_url: string;
  source_name: string;
}

export default function FoodbankFormPage() {
  const { foodbankId } = useParams<{ foodbankId: string }>();
  const isEdit = !!foodbankId;
  const navigate = useNavigate();

  const { data: existing } = useFoodbank(foodbankId);
  const createMutation = useCreateFoodbank();
  const updateMutation = useUpdateFoodbank();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
  } = useForm<FoodbankFormData>({ mode: 'onChange' });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name || '',
        country: existing.country || '',
        state: existing.state || '',
        description: existing.description || '',
        location_name: existing.location_name || '',
        location_address: existing.location_address || '',
        location_link: existing.location_link || '',
        latitude: existing.latitude != null ? String(existing.latitude) : '',
        longitude: existing.longitude != null ? String(existing.longitude) : '',
        source_url: existing.source_url || '',
        source_name: existing.source_name || '',
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: FoodbankFormData) => {
    const payload = {
      ...data,
      latitude: data.latitude ? Number(data.latitude) : null,
      longitude: data.longitude ? Number(data.longitude) : null,
    };

    if (isEdit) {
      await updateMutation.mutateAsync({ id: foodbankId!, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    navigate('/foodbanks');
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/foodbanks" className="text-ga-accent hover:underline text-sm">
          ← Foodbanks
        </Link>
        <span className="text-ga-text-secondary text-sm mx-2">/</span>
        <span className="text-ga-text-primary text-sm">
          {isEdit ? `Edit "${existing?.name || foodbankId}"` : 'Add Foodbank'}
        </span>
      </div>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Name"
            name="name"
            register={register}
            errors={errors}
            required
            placeholder="Foodbank name"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">
                Country<span className="text-red-400 ml-0.5">*</span>
              </label>
              <select
                {...register('country', { required: 'Country is required' })}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
              >
                <option value="">Select country</option>
                {FOODBANK_COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {errors.country?.message && (
                <p className="text-xs text-red-400 mt-1">{String(errors.country.message)}</p>
              )}
            </div>
            <FormField
              label="State"
              name="state"
              register={register}
              errors={errors}
              required
              placeholder="e.g. Selangor"
            />
          </div>

          <FormField
            label="Description"
            name="description"
            register={register}
            errors={errors}
            rows={3}
            placeholder="Brief description"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Location Name"
              name="location_name"
              register={register}
              errors={errors}
              placeholder="e.g. Main Branch"
            />
            <FormField
              label="Location Address"
              name="location_address"
              register={register}
              errors={errors}
              placeholder="Full address"
            />
          </div>

          <FormField
            label="Map Link"
            name="location_link"
            register={register}
            errors={errors}
            placeholder="https://maps.google.com/..."
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Latitude"
              name="latitude"
              type="number"
              register={register}
              errors={errors}
              placeholder="e.g. 3.1390"
              rules={{ min: -90, max: 90 }}
            />
            <FormField
              label="Longitude"
              name="longitude"
              type="number"
              register={register}
              errors={errors}
              placeholder="e.g. 101.6869"
              rules={{ min: -180, max: 180 }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Source URL"
              name="source_url"
              register={register}
              errors={errors}
              placeholder="https://..."
            />
            <FormField
              label="Source Name"
              name="source_name"
              register={register}
              errors={errors}
              placeholder="e.g. Official Website"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              to="/foodbanks"
              className="px-4 py-2 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Foodbank' : 'Create Foodbank'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
