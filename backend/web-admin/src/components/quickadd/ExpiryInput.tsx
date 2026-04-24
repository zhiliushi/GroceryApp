import { useMemo } from 'react';

/**
 * Expiry text input with client-side preview of parsed date.
 * Sends the raw string to the backend's NL parser (app.services.nl_expiry)
 * via `expiry_raw` on the purchase create request.
 */
interface ExpiryInputProps {
  value: string;
  onChange: (raw: string) => void;
}

// Minimal client-side parser mirror for live feedback. The authoritative parse
// happens server-side — this just gives the user confidence their input will
// be understood.
function previewParse(text: string, now = new Date()): { label: string; tone: 'ok' | 'none' | 'unknown' } {
  const t = text.trim().toLowerCase();
  if (!t) return { label: '', tone: 'unknown' };
  const noExpiry = new Set(['no expiry', 'no exp', 'n/a', 'na', 'none', 'never']);
  if (noExpiry.has(t)) return { label: 'No expiry tracked', tone: 'none' };
  if (t === 'today') return { label: now.toLocaleDateString(), tone: 'ok' };
  if (t === 'tomorrow' || t === 'tmrw' || t === 'tmr') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { label: d.toLocaleDateString(), tone: 'ok' };
  }
  const inMatch = /^in\s+(\d+)\s+(day|days|week|weeks|month|months)$/.exec(t) || /^(\d+)\s+(day|days|week|weeks|month|months)$/.exec(t);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const d = new Date(now);
    if (unit.includes('day')) d.setDate(d.getDate() + n);
    else if (unit.includes('week')) d.setDate(d.getDate() + n * 7);
    else d.setDate(d.getDate() + n * 30);
    return { label: d.toLocaleDateString(), tone: 'ok' };
  }
  if (t === 'next week') {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return { label: d.toLocaleDateString(), tone: 'ok' };
  }
  const iso = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(t);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return { label: dt.toLocaleDateString(), tone: 'ok' };
  }
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(t);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    const dt = new Date(y, parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    if (!isNaN(dt.getTime())) return { label: dt.toLocaleDateString(), tone: 'ok' };
  }
  return { label: 'Will try to parse on save', tone: 'unknown' };
}

export default function ExpiryInput({ value, onChange }: ExpiryInputProps) {
  const preview = useMemo(() => previewParse(value), [value]);

  return (
    <div>
      <label className="block text-xs text-ga-text-secondary mb-1">
        Expiry — e.g. "tomorrow", "next week", "in 5 days", or a date
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='"tomorrow" or "2026-05-15" or "no expiry"'
        className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
      />
      {preview.label && (
        <div
          className={
            preview.tone === 'ok'
              ? 'text-xs text-green-500 mt-1'
              : preview.tone === 'none'
              ? 'text-xs text-ga-text-secondary mt-1'
              : 'text-xs text-yellow-500 mt-1'
          }
        >
          → {preview.label}
        </div>
      )}
    </div>
  );
}
