import { cn } from '@/utils/cn';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-ga-text-secondary whitespace-nowrap">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-ga-bg-primary border border-ga-border rounded-md px-2 py-1.5 text-sm text-ga-text-primary outline-none focus:border-ga-accent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function FilterCheckbox({ label, checked, onChange }: FilterCheckboxProps) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-ga-text-secondary cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-ga-border accent-ga-accent"
      />
      {label}
    </label>
  );
}

interface FilterBarProps {
  children: React.ReactNode;
  onApply: () => void;
  className?: string;
}

export default function FilterBar({ children, onApply, className }: FilterBarProps) {
  return (
    <div className={cn('bg-ga-bg-card border border-ga-border rounded-lg px-4 py-2.5 flex items-center gap-4 flex-wrap', className)}>
      {children}
      <button
        onClick={onApply}
        className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
      >
        Apply
      </button>
    </div>
  );
}

FilterBar.Dropdown = FilterDropdown;
FilterBar.Checkbox = FilterCheckbox;
