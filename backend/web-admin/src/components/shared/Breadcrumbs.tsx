import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export interface BreadcrumbItem {
  label: string;
  to?: string; // absent = current page (no link)
}

/**
 * Plan navigation principle: breadcrumbs for drill-down pages, e.g.
 * "Dashboard › My Items › Milk › Purchase details".
 *
 * Usage: each drill-down page imports + renders above PageHeader with its own items.
 * The leaf item (current page) has no `to` prop.
 *
 * Kept intentionally dumb — no route-param magic. Pages fetch their own entity
 * data (which they already do for rendering) and pass the human label.
 */
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-ga-text-secondary mb-3">
      <ol className="flex items-center flex-wrap gap-x-1 gap-y-0.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${idx}-${item.label}`} className="flex items-center gap-1">
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-ga-text-primary hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast && 'text-ga-text-primary font-medium')}>
                  {item.label}
                </span>
              )}
              {!isLast && <span aria-hidden className="text-ga-text-secondary">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
