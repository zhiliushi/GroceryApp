import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/api/endpoints';

/**
 * AboutPage — publicly reachable page that surfaces external links the
 * operator wants to share: donation channels, reference reads, social.
 *
 * Reads /api/external-links (no auth) so the page works for logged-out
 * visitors too. Admin manages entries via Admin Settings → External Links.
 */

interface ExternalLink {
  id: string;
  label: string;
  url: string;
  category: 'donation' | 'reference' | 'social' | 'other' | string;
  description?: string | null;
  icon?: string | null;
  sort_order?: number;
  enabled?: boolean;
}

interface PublicLinksResponse {
  items: ExternalLink[];
  by_category: Record<string, ExternalLink[]>;
  categories: string[];
}

const CATEGORY_TITLES: Record<string, { title: string; blurb: string; icon: string }> = {
  donation: {
    title: 'Support GroceryApp',
    blurb: "If GroceryApp helps you, you can support continued development.",
    icon: '💛',
  },
  reference: {
    title: 'Further reading',
    blurb: 'Topics relevant to home food management, waste reduction, and the project itself.',
    icon: '📚',
  },
  social: {
    title: 'Follow / connect',
    blurb: 'Social and community channels.',
    icon: '🌐',
  },
  other: {
    title: 'Other links',
    blurb: '',
    icon: '🔗',
  },
};

const CATEGORY_ORDER = ['donation', 'reference', 'social', 'other'];

export default function AboutPage() {
  const [data, setData] = useState<PublicLinksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(API.EXTERNAL_LINKS, { credentials: 'omit' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as PublicLinksResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load links';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-ga-bg-primary">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          to="/dashboard"
          className="text-sm text-ga-accent hover:underline inline-flex items-center gap-1"
        >
          ← Back to app
        </Link>
        <h1 className="text-3xl font-bold text-ga-text-primary mt-4 mb-2">About GroceryApp</h1>
        <p className="text-sm text-ga-text-secondary mb-8 max-w-2xl leading-relaxed">
          GroceryApp tracks the groceries you buy, what's still in your kitchen, and what
          ends up wasted — so you can shop smarter and waste less. The app is built and
          maintained by an independent developer; the links below are how to support it,
          read related material, and reach out.
        </p>

        {loading && (
          <div className="text-sm text-ga-text-secondary">Loading links…</div>
        )}

        {error && (
          <div className="text-sm text-red-400">
            Couldn't load links: {error}
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="text-sm text-ga-text-secondary border border-ga-border rounded-lg p-4 bg-ga-bg-card">
            No links yet. The site operator can add donation / reference / social links from
            Admin Settings → External Links.
          </div>
        )}

        {data &&
          CATEGORY_ORDER.filter(
            (cat) => (data.by_category[cat] || []).length > 0,
          ).map((cat) => {
            const meta = CATEGORY_TITLES[cat] || {
              title: cat,
              blurb: '',
              icon: '🔗',
            };
            const links = (data.by_category[cat] || []).slice().sort(
              (a, b) =>
                (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                a.label.localeCompare(b.label),
            );
            return (
              <section key={cat} className="mb-8">
                <h2 className="text-xl font-semibold text-ga-text-primary mb-1 flex items-center gap-2">
                  <span>{meta.icon}</span>
                  <span>{meta.title}</span>
                </h2>
                {meta.blurb && (
                  <p className="text-xs text-ga-text-secondary mb-3 max-w-xl">
                    {meta.blurb}
                  </p>
                )}
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li
                      key={link.id}
                      className="bg-ga-bg-card border border-ga-border rounded-lg p-3 hover:border-ga-accent/40 transition-colors"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 group"
                      >
                        <span className="text-xl flex-shrink-0 leading-none mt-0.5">
                          {link.icon || meta.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-ga-text-primary group-hover:text-ga-accent">
                            {link.label}
                          </span>
                          {link.description && (
                            <span className="block text-xs text-ga-text-secondary mt-0.5">
                              {link.description}
                            </span>
                          )}
                          <span className="block text-[11px] text-ga-text-secondary/70 mt-1 truncate">
                            {link.url}
                          </span>
                        </span>
                        <span className="text-ga-text-secondary text-xs flex-shrink-0 mt-1">
                          ↗
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

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
            <Link to="/help" className="text-ga-accent hover:underline">
              User Manual
            </Link>
            {' · '}
            <Link to="/dashboard" className="text-ga-accent hover:underline">
              App
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
