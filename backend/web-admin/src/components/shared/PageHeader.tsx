interface PageHeaderProps {
  title: string;
  icon?: string;
  count?: number;
  action?: React.ReactNode;
  subtitle?: React.ReactNode;
}

export default function PageHeader({ title, icon, count, action, subtitle }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <h1 className="text-xl font-semibold text-ga-text-primary">{title}</h1>
        {count != null && (
          <span className="bg-ga-accent text-white text-xs font-medium rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {count}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {subtitle && <span className="text-sm text-ga-text-secondary">{subtitle}</span>}
        {action}
      </div>
    </div>
  );
}
