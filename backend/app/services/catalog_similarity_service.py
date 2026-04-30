"""Catalog similarity service — Phase G of catalog_evolution.md.

Two responsibilities:
  1. `find_similar(user_id, query, limit)` — autocomplete-style "did you mean?"
     suggestions for the QuickAddModal. Top N matches ranked by combined
     Levenshtein + token-overlap score.
  2. `find_likely_duplicates(user_id)` — passive suggestion list for the
     Settings → Merge Nudge widget. Pairs of catalog rows whose names look
     like duplicates the user might want to consolidate.

The similarity score is `max(levenshtein_ratio, token_jaccard)`, both in [0,1].
A threshold of 0.6 is the cutoff for "potentially related" vs "different."

O(N) for find_similar, O(N²) for find_likely_duplicates. Fine for Shahir's
small user base; would need an index (or batched comparison) at scale.
"""

from __future__ import annotations

import logging
import re
from difflib import SequenceMatcher
from typing import Any

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

_CATALOG_COLLECTION = "catalog_entries"
_DEFAULT_THRESHOLD = 0.6
_DUPLICATE_THRESHOLD = 0.7  # stricter for unprompted suggestions
_MAX_CATALOG_FOR_PAIRWISE = 200  # safety cap on O(N²) sweep


def _db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Similarity scoring
# ---------------------------------------------------------------------------


def _tokens(s: str) -> set[str]:
    return set(t for t in re.findall(r"\w+", (s or "").lower()) if len(t) >= 2)


def _levenshtein_ratio(a: str, b: str) -> float:
    """SequenceMatcher.ratio is close-enough to Levenshtein for ranking."""
    if not a and not b:
        return 0.0
    return SequenceMatcher(None, (a or "").lower(), (b or "").lower()).ratio()


def _token_jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta and not tb:
        return 0.0
    union = ta | tb
    if not union:
        return 0.0
    return len(ta & tb) / len(union)


def similarity_score(a: str, b: str) -> float:
    """Combined score in [0,1]. max() of two cheap measures."""
    return max(_levenshtein_ratio(a, b), _token_jaccard(a, b))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def find_similar(
    user_id: str,
    query: str,
    limit: int = 3,
    threshold: float = _DEFAULT_THRESHOLD,
    exclude_name_norm: str | None = None,
) -> list[dict[str, Any]]:
    """Top-N catalog rows matching `query` by name similarity.

    Returns each candidate enriched with `score` (float), sorted desc.
    """
    if not query or not query.strip():
        return []
    db = _db()
    out: list[dict[str, Any]] = []
    for snap in (
        db.collection(_CATALOG_COLLECTION)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .stream()
    ):
        d = snap.to_dict() or {}
        if exclude_name_norm and d.get("name_norm") == exclude_name_norm:
            continue
        score = similarity_score(query, d.get("display_name") or "")
        if score < threshold:
            continue
        out.append({
            "name_norm": d.get("name_norm"),
            "display_name": d.get("display_name"),
            "barcode": d.get("barcode"),
            "catalog_mode": d.get("catalog_mode"),
            "total_purchases": int(d.get("total_purchases") or 0),
            "active_purchases": int(d.get("active_purchases") or 0),
            "last_purchased_at": _iso(d.get("last_purchased_at")),
            "score": round(score, 3),
        })
    out.sort(key=lambda r: -r["score"])
    return out[:limit]


def find_likely_duplicates(
    user_id: str,
    threshold: float = _DUPLICATE_THRESHOLD,
    max_pairs: int = 10,
) -> list[dict[str, Any]]:
    """Pairs of catalog rows that look like duplicates.

    Returns up to `max_pairs` highest-scoring pairs above `threshold`.
    Each pair: {a, b, score, why}. Skips identical name_norms.
    """
    db = _db()
    rows: list[dict] = []
    for snap in (
        db.collection(_CATALOG_COLLECTION)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .stream()
    ):
        d = snap.to_dict() or {}
        rows.append(d)
        if len(rows) >= _MAX_CATALOG_FOR_PAIRWISE:
            logger.info(
                "find_likely_duplicates: capped sweep at %d rows for user=%s",
                _MAX_CATALOG_FOR_PAIRWISE, user_id,
            )
            break

    pairs: list[dict[str, Any]] = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            a, b = rows[i], rows[j]
            if a.get("name_norm") == b.get("name_norm"):
                continue
            # Same barcode + non-equal name = likely a rename pair (mode-a).
            same_barcode = bool(a.get("barcode")) and a.get("barcode") == b.get("barcode")
            score = similarity_score(a.get("display_name") or "", b.get("display_name") or "")
            if same_barcode:
                score = max(score, 0.95)  # treat barcode match as near-certain pair
            if score < threshold:
                continue
            pairs.append({
                "a": _summary(a),
                "b": _summary(b),
                "score": round(score, 3),
                "why": "shared_barcode" if same_barcode else "name_similarity",
            })

    pairs.sort(key=lambda p: -p["score"])
    return pairs[:max_pairs]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _summary(cat: dict) -> dict:
    return {
        "name_norm": cat.get("name_norm"),
        "display_name": cat.get("display_name"),
        "barcode": cat.get("barcode"),
        "catalog_mode": cat.get("catalog_mode"),
        "total_purchases": int(cat.get("total_purchases") or 0),
        "active_purchases": int(cat.get("active_purchases") or 0),
        "last_purchased_at": _iso(cat.get("last_purchased_at")),
    }


def _iso(v: Any) -> str | None:
    if v is None:
        return None
    try:
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    except Exception:
        return None
