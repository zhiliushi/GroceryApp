"""Preppers eligibility — readiness check for the preppers feature.

The preppers feature derives a lot of value from analytics on a user's
buying + cooking history (predicting when stockpile runs out, what to
preserve more of, when to start a new batch). With less than ~30 days
of data, those predictions are unreliable, so the UI shows users their
*data readiness score* — a transparent "you're 12 of 30 days in" signal.

Beta posture (2026-05-04): score is INFORMATIONAL ONLY. The /preppers
routes don't enforce it. The score is shown so users understand why
the analytics will improve over time.

Future (post-beta): when full analytics ship, the score gates the
analytics-heavy features (recommendations, predictions). The basic
batch-tracker stays open regardless.

Phase P8 of preppers.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from firebase_admin import firestore

logger = logging.getLogger(__name__)

# Minimum data age required for analytics to be meaningful. The user's
# first cooking + buying window needs to span this period for trend
# detection to work.
DAYS_REQUIRED = 30

# Floor on purchase count — even with 30 days elapsed, a user with 2
# purchases lifetime won't have enough signal. Scaled separately.
MIN_PURCHASES = 10


def _db():
    return firestore.client()


def _earliest_purchase_dt(uid: str) -> Optional[datetime]:
    """Earliest `date_bought` (or `created_at` fallback) across the user's
    purchases collection. None if no purchases."""
    q = (
        _db().collection("users").document(uid).collection("purchases")
        .order_by("date_bought", direction=firestore.Query.ASCENDING)
        .limit(1)
    )
    for doc in q.stream():
        data = doc.to_dict() or {}
        raw = data.get("date_bought") or data.get("created_at")
        if hasattr(raw, "to_datetime"):
            raw = raw.to_datetime()
        if isinstance(raw, datetime):
            if raw.tzinfo is None:
                raw = raw.replace(tzinfo=timezone.utc)
            return raw
    return None


def _user_signup_dt(uid: str) -> Optional[datetime]:
    """User's account creation timestamp. Falls back to first purchase
    if missing — but for users created via Onboarding v2, created_at is
    always present."""
    snap = _db().collection("users").document(uid).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    ts = data.get("created_at")
    # users.created_at is stored as int milliseconds (see user_service)
    if isinstance(ts, int):
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
    if hasattr(ts, "to_datetime"):
        ts = ts.to_datetime()
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts
    return None


def _purchase_count(uid: str) -> int:
    """Approx total purchases. Cheap enough — Firestore counts are O(N)
    on the doc count, but small for typical users."""
    n = 0
    for _ in (
        _db().collection("users").document(uid).collection("purchases")
        .select([]).stream()
    ):
        n += 1
    return n


def compute_eligibility(uid: str, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Full eligibility report for a user.

    Returns:
        {
          eligible: bool,
          score: float 0..1,
          days_active: int,
          days_required: int,
          first_active_at: ISO string | None,
          total_purchases: int,
          min_purchases: int,
          explanation: str,
        }
    """
    now = now or datetime.now(timezone.utc)

    signup = _user_signup_dt(uid)
    earliest_purchase = _earliest_purchase_dt(uid)
    # First-active = earliest of signup or earliest purchase. Some accounts
    # are imported with purchases predating their official signup.
    candidates = [d for d in (signup, earliest_purchase) if d is not None]
    first_active = min(candidates) if candidates else None

    days_active = (
        (now - first_active).days if first_active is not None else 0
    )
    total_purchases = _purchase_count(uid)

    # Score = average of two normalised signals, both clamped 0..1.
    days_signal = min(days_active / DAYS_REQUIRED, 1.0)
    purch_signal = min(total_purchases / MIN_PURCHASES, 1.0)
    score = round((days_signal + purch_signal) / 2.0, 3)

    eligible = (
        days_active >= DAYS_REQUIRED
        and total_purchases >= MIN_PURCHASES
    )

    if eligible:
        explanation = (
            f"Ready: {days_active} days of activity and {total_purchases} "
            f"purchases logged. Analytics will be meaningful."
        )
    elif first_active is None:
        explanation = (
            "No activity logged yet. Add a few purchases to start building "
            f"your data window (need {DAYS_REQUIRED} days + {MIN_PURCHASES} "
            "purchases for full analytics)."
        )
    else:
        days_left = max(DAYS_REQUIRED - days_active, 0)
        purch_left = max(MIN_PURCHASES - total_purchases, 0)
        bits = []
        if days_left:
            bits.append(f"{days_left} more day{'s' if days_left != 1 else ''}")
        if purch_left:
            bits.append(f"{purch_left} more purchase{'s' if purch_left != 1 else ''}")
        explanation = (
            f"Building up: {days_active}/{DAYS_REQUIRED} days, "
            f"{total_purchases}/{MIN_PURCHASES} purchases. "
            f"Need {' + '.join(bits)} for full analytics."
        )

    return {
        "eligible": eligible,
        "score": score,
        "days_active": days_active,
        "days_required": DAYS_REQUIRED,
        "first_active_at": first_active.isoformat() if first_active else None,
        "total_purchases": total_purchases,
        "min_purchases": MIN_PURCHASES,
        "explanation": explanation,
    }
