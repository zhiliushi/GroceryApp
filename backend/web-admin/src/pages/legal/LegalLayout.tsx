import { Link } from 'react-router-dom';

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/**
 * Shared layout for legal pages (privacy, terms). Renders a no-frills,
 * easy-to-read view that works for both authenticated and unauthenticated
 * visitors — these pages are publicly reachable.
 *
 * Source of truth: docs/legal/*.md. The TSX text below mirrors those files;
 * if they drift, treat the .md as canonical (a lawyer reviews the .md).
 */
export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-ga-bg-primary">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          to="/dashboard"
          className="text-sm text-ga-accent hover:underline inline-flex items-center gap-1"
        >
          ← Back to app
        </Link>
        <h1 className="text-3xl font-bold text-ga-text-primary mt-4 mb-1">{title}</h1>
        <p className="text-xs text-ga-text-secondary mb-6">Last updated: {lastUpdated}</p>
        <article className="prose prose-sm max-w-none text-ga-text-primary space-y-4 leading-relaxed">
          {children}
        </article>
        <footer className="mt-12 pt-6 border-t border-ga-border text-xs text-ga-text-secondary">
          <p>
            Cross-links:{' '}
            <Link to="/privacy" className="text-ga-accent hover:underline">
              Privacy Policy
            </Link>
            {' · '}
            <Link to="/terms" className="text-ga-accent hover:underline">
              Terms of Service
            </Link>
            {' · '}
            <Link to="/dashboard" className="text-ga-accent hover:underline">
              App
            </Link>
          </p>
          <p className="mt-2">
            This is a beta-stage template, not legal advice. Operator: [Your Name / Company].
          </p>
        </footer>
      </div>
    </div>
  );
}
