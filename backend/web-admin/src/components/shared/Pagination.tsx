interface PaginationProps {
  showing: string;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export default function Pagination({ showing, hasNext, hasPrev, onNext, onPrev }: PaginationProps) {
  if (!showing) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-ga-border">
      <span className="text-xs text-ga-text-secondary">{showing}</span>
      <div className="flex gap-1">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-3 py-1 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Prev
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="px-3 py-1 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
