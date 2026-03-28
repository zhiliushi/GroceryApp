import type { UseFormRegister, FieldErrors, RegisterOptions } from 'react-hook-form';
import { cn } from '@/utils/cn';

interface FormFieldProps {
  label: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  type?: string;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  rules?: RegisterOptions;
  rows?: number;
}

export default function FormField({
  label,
  name,
  register,
  errors,
  type = 'text',
  required,
  placeholder,
  readOnly,
  className,
  rules,
  rows,
}: FormFieldProps) {
  const error = errors[name];
  const inputClass = cn(
    'w-full bg-ga-bg-primary border rounded-md px-3 py-2 text-sm text-ga-text-primary placeholder:text-gray-600 outline-none transition-colors',
    error ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : 'border-ga-border focus:border-ga-accent focus:ring-1 focus:ring-ga-accent/30',
    readOnly && 'opacity-60 cursor-not-allowed',
  );

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {rows ? (
        <textarea
          {...register(name, { required: required ? `${label} is required` : false, ...rules })}
          placeholder={placeholder}
          readOnly={readOnly}
          rows={rows}
          className={cn(inputClass, 'resize-y min-h-[80px]')}
        />
      ) : (
        <input
          type={type}
          {...register(name, { required: required ? `${label} is required` : false, ...rules })}
          placeholder={placeholder}
          readOnly={readOnly}
          className={inputClass}
        />
      )}
      {error?.message && (
        <p className="text-xs text-red-400 mt-1">{String(error.message)}</p>
      )}
    </div>
  );
}
