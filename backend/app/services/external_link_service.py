"""External link directory — manageable list of donation / reference / social /
other URLs surfaced on the public About page.

Storage: top-level `external_links/{auto_id}` collection (mirrors the
feedback-collection pattern). The About page reads enabled-only; the admin
tab manages the full list.

Categories are a fixed enum so the About page can group consistently. Adding
a new category = code change (intentional — keeps the page predictable).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)

_COLLECTION = "external_links"
_VALID_CATEGORIES = ("donation", "reference", "social", "other")
_MAX_LABEL_LEN = 80
_MAX_DESCRIPTION_LEN = 200
_MAX_URL_LEN = 500


def _db():
    return firestore.client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate(
    *,
    label: Optional[str] = None,
    url: Optional[str] = None,
    category: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
) -> None:
    if label is not None:
        s = (label or "").strip()
        if not s:
            raise ValidationError("label is required")
        if len(s) > _MAX_LABEL_LEN:
            raise ValidationError(f"label must be ≤ {_MAX_LABEL_LEN} chars")
    if url is not None:
        s = (url or "").strip()
        if not s:
            raise ValidationError("url is required")
        if len(s) > _MAX_URL_LEN:
            raise ValidationError(f"url must be ≤ {_MAX_URL_LEN} chars")
        if not (s.startswith("http://") or s.startswith("https://")):
            raise ValidationError("url must start with http:// or https://")
    if category is not None and category not in _VALID_CATEGORIES:
        raise ValidationError(
            f"category must be one of {list(_VALID_CATEGORIES)}"
        )
    if description is not None and len(description) > _MAX_DESCRIPTION_LEN:
        raise ValidationError(
            f"description must be ≤ {_MAX_DESCRIPTION_LEN} chars"
        )
    if icon is not None and len(icon) > 8:
        raise ValidationError("icon must be ≤ 8 chars (emoji or short symbol)")


def list_links(
    *,
    category: Optional[str] = None,
    enabled_only: bool = True,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """List external links. Public callers use enabled_only=True; admin uses False."""
    if category is not None and category not in _VALID_CATEGORIES:
        raise ValidationError(
            f"category must be one of {list(_VALID_CATEGORIES)}"
        )
    q = _db().collection(_COLLECTION)
    if category:
        q = q.where(filter=FieldFilter("category", "==", category))
    if enabled_only:
        q = q.where(filter=FieldFilter("enabled", "==", True))
    # Order by sort_order then created_at; clients also re-sort defensively.
    q = q.limit(limit)
    out: list[dict[str, Any]] = []
    for snap in q.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        out.append(data)
    out.sort(
        key=lambda d: (
            int(d.get("sort_order") or 0),
            str(d.get("created_at") or ""),
        )
    )
    return out


def create_link(
    *,
    label: str,
    url: str,
    category: str,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    sort_order: int = 0,
    enabled: bool = True,
    created_by: Optional[str] = None,
) -> dict[str, Any]:
    _validate(label=label, url=url, category=category, description=description, icon=icon)
    doc = {
        "id": str(uuid.uuid4()),
        "label": label.strip(),
        "url": url.strip(),
        "category": category,
        "description": (description or "").strip() or None,
        "icon": (icon or "").strip() or None,
        "sort_order": int(sort_order or 0),
        "enabled": bool(enabled),
        "created_by": created_by,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "schema_version": 1,
    }
    _db().collection(_COLLECTION).document(doc["id"]).set(doc)
    logger.info(
        "external_links.created id=%s category=%s label=%s",
        doc["id"], category, doc["label"],
    )
    return doc


def update_link(
    link_id: str,
    *,
    label: Optional[str] = None,
    url: Optional[str] = None,
    category: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    sort_order: Optional[int] = None,
    enabled: Optional[bool] = None,
) -> dict[str, Any]:
    _validate(label=label, url=url, category=category, description=description, icon=icon)
    doc_ref = _db().collection(_COLLECTION).document(link_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"External link {link_id} not found")

    updates: dict[str, Any] = {"updated_at": _now_iso()}
    if label is not None:
        updates["label"] = label.strip()
    if url is not None:
        updates["url"] = url.strip()
    if category is not None:
        updates["category"] = category
    if description is not None:
        updates["description"] = description.strip() or None
    if icon is not None:
        updates["icon"] = icon.strip() or None
    if sort_order is not None:
        updates["sort_order"] = int(sort_order)
    if enabled is not None:
        updates["enabled"] = bool(enabled)
    doc_ref.update(updates)

    out = snap.to_dict() or {}
    out.update(updates)
    out["id"] = link_id
    return out


def delete_link(link_id: str) -> dict[str, Any]:
    doc_ref = _db().collection(_COLLECTION).document(link_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"External link {link_id} not found")
    doc_ref.delete()
    logger.info("external_links.deleted id=%s", link_id)
    return {"id": link_id, "deleted": True}


def seed_defaults_if_empty() -> int:
    """Seed an initial Ko-fi donation link if the collection is empty.

    Returns the number of links inserted (0 if collection already populated).
    Idempotent — safe to call multiple times.
    """
    coll = _db().collection(_COLLECTION)
    if any(True for _ in coll.limit(1).stream()):
        return 0
    create_link(
        label="Support on Ko-fi",
        url="https://ko-fi.com/shahfurqan",
        category="donation",
        description="If GroceryApp helps you, you can buy me a coffee.",
        icon="☕",
        sort_order=0,
        enabled=True,
        created_by="seed",
    )
    return 1


VALID_CATEGORIES = _VALID_CATEGORIES
