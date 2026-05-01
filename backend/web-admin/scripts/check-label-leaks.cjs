#!/usr/bin/env node
/**
 * check-label-leaks.js — quick-check for the "data model leaking
 * through the UI" bug class.
 *
 * Background: in April/May 2026, QuickAddModal rendered column headers
 * by composing `pack_label` + `base_unit` into strings:
 *
 *     <label># {packLabel}{packCount === 1 ? '' : 's'}</label>
 *     <label>{unit}/{packLabel}</label>
 *
 * When pack_label="loose" the result was "# LOOSE", "COUNT/LOOSE",
 * "Price/loose" — internal jargon shown to the user. The fix was to
 * use STATIC labels for column headers and never compose them from
 * runtime data values.
 *
 * This script greps source for known offender patterns. Run it as
 * part of the build / pre-commit. Emits non-zero exit on hits.
 *
 * Usage:
 *   node scripts/check-label-leaks.js          # check src/
 *   node scripts/check-label-leaks.js --quiet  # just exit code, no list
 *
 * Suppress false positives by adding `// LABEL_OK` on the line.
 *
 * See `.claude/docs/project_context.md` "UI label discipline" and
 * `.claude/docs/unit-type-method.md` "Static labels rule" for the
 * canonical rule.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const ALLOW_TAG = 'LABEL_OK';

// Variable / property names that hold technical enum-key values. NEVER
// render them directly as user-facing text.
const RISKY_NAMES = [
  'packLabel', 'pack_label',
  'unit_type', 'unitType',
  'name_norm', 'nameNorm',
  'base_unit_label', 'baseUnitLabel',
];

const RISKY_GROUP = `(?:${RISKY_NAMES.join('|')})`;

// Patterns that signal a leak. Each carries a `why` so the reporter
// explains rather than just lists.
const PATTERNS = [
  {
    name: 'template-composes-key-into-label',
    regex: new RegExp(
      String.raw`\\\`[^\\\`]*\$\{[^}]*\b` + RISKY_GROUP + String.raw`\b[^}]*\}[^\\\`]*\\\``,
      'g',
    ),
    why:
      'Template literal composes a data-model key into a string. ' +
      'If this string is shown as a label, use a static label or label-registry helper.',
  },
  {
    name: 'jsx-text-renders-raw-key',
    regex: new RegExp(
      String.raw`>\s*\{\s*` + RISKY_GROUP + String.raw`\s*\}`,
      'g',
    ),
    why:
      'Raw data-key variable rendered as JSX text. Translate via the ' +
      'label registry before rendering, OR confirm with `// LABEL_OK`.',
  },
  {
    name: 'header-tag-composes-key',
    regex: new RegExp(
      String.raw`<(label|h[1-6]|th)\b[^>]*>([^<]*\{[^}]*\b` + RISKY_GROUP + String.raw`\b[^}]*\}[^<]*)<`,
      'g',
    ),
    why:
      'Header / label tag composed from a data-model key. Headers must ' +
      'be static strings — see "static labels rule" in unit-type-method.md.',
  },
];

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) yield p;
  }
}

function findLeaks() {
  const hits = [];
  for (const file of walk(SRC_DIR)) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = src.split('\n');
    for (const { name, regex, why } of PATTERNS) {
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(src)) !== null) {
        const lineNum = src.slice(0, m.index).split('\n').length;
        const lineText = lines[lineNum - 1] || '';
        if (lineText.includes(ALLOW_TAG)) continue;
        const rel = path.relative(path.resolve(SRC_DIR, '..'), file);
        hits.push({
          file: rel,
          line: lineNum,
          column: m.index - src.lastIndexOf('\n', m.index - 1),
          name,
          snippet: m[0].length > 100 ? m[0].slice(0, 100) + '…' : m[0],
          why,
        });
      }
    }
  }
  return hits;
}

function main() {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');

  const hits = findLeaks();
  if (hits.length === 0) {
    if (!quiet) {
      console.log('✓ check-label-leaks: no known label-leak patterns in src/.');
    }
    process.exit(0);
  }

  if (!quiet) {
    console.error('');
    console.error('❌ check-label-leaks: possible UI label leaks');
    console.error(
      '   (data-model values composed into user-facing labels — like the',
    );
    console.error('   QuickAddModal "# LOOSE" header bug from May 2026).');
    console.error('');
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}  [${h.name}]`);
      console.error(`    ${h.snippet.trim()}`);
      console.error(`    why: ${h.why}`);
      console.error('');
    }
    console.error('Fixes:');
    console.error('  • Replace with a static label string ("# Packs" not "# {packLabel}s").');
    console.error('  • OR translate via a label registry before rendering.');
    console.error('  • OR (if intentional, e.g. debug panel) tag the line with `// LABEL_OK`.');
    console.error('');
    console.error('Discipline: `.claude/docs/project_context.md` "UI label discipline".');
    console.error(`Hits: ${hits.length}`);
  }
  process.exit(1);
}

main();
