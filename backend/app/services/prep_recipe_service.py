"""Preppers recipe service — user-added preservation templates.

Templates the user saves so they can start a batch repeatedly without
re-typing all the fields. Distinct from `users/{uid}/recipes` (cooking
recipes) — these have prep-specific fields (prep_type, ready_after_hours,
shelf_life_days) and feed into the preppers batch flow.

Cap is generous (50 per user for first cut). Tier-specific caps come
later if pressure shows up.

Phase P1 of preppers.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

from app.services import common_preserves_service

logger = logging.getLogger(__name__)

PREP_RECIPE_LIMIT = 50
MAX_INGREDIENTS_PER_PREP = 25
SCHEMA_VERSION = 1


def _db():
    return firestore.client()


def _user_prep_recipes_ref(uid: str):
    return _db().collection("users").document(uid).collection("prep_recipes")


def _normalize_ingredients(raw: Any) -> List[Dict[str, Any]]:
    """Coerce ingredient input to list of dicts. Same shape as recipes."""
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for ing in raw[:MAX_INGREDIENTS_PER_PREP]:
        if isinstance(ing, str):
            out.append({"name": ing.strip(), "quantity": None, "unit": None})
        elif isinstance(ing, dict):
            name = (ing.get("name") or "").strip()
            if not name:
                continue
            out.append({
                "name": name,
                "quantity": ing.get("quantity"),
                "unit": ing.get("unit"),
            })
    return out


def list_recipes(uid: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for doc in _user_prep_recipes_ref(uid).stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        out.append(data)
    out.sort(key=lambda r: (r.get("name") or "").lower())
    return out


def get_recipe(uid: str, rid: str) -> Optional[Dict[str, Any]]:
    doc = _user_prep_recipes_ref(uid).document(rid).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data


def create_recipe(uid: str, body: Dict[str, Any]) -> Dict[str, Any]:
    name = (body.get("name") or "").strip()
    if not name:
        raise ValueError("name is required")

    prep_type = (body.get("prep_type") or "").strip()
    if prep_type not in common_preserves_service.VALID_PREP_TYPES:
        raise ValueError(
            f"invalid prep_type; must be one of "
            f"{sorted(common_preserves_service.VALID_PREP_TYPES)}",
        )

    ready_after_hours = int(body.get("ready_after_hours") or 0)
    shelf_life_days = int(body.get("shelf_life_days") or 0)
    if ready_after_hours < 0 or shelf_life_days <= 0:
        raise ValueError(
            "ready_after_hours must be >= 0 and shelf_life_days must be > 0",
        )

    # Quota check
    existing = list(_user_prep_recipes_ref(uid).limit(PREP_RECIPE_LIMIT + 1).stream())
    if len(existing) >= PREP_RECIPE_LIMIT:
        raise ValueError(f"prep recipe limit reached ({PREP_RECIPE_LIMIT})")

    servings = max(int(body.get("servings") or 4), 1)

    rid = uuid.uuid4().hex[:16]
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "prep_type": prep_type,
        "ready_after_hours": ready_after_hours,
        "shelf_life_days": shelf_life_days,
        "servings": servings,
        "ingredients": _normalize_ingredients(body.get("ingredients")),
        "notes": (body.get("notes") or "").strip(),
        "common_preserve_ref": body.get("common_preserve_ref") or None,
        "created_at": now,
        "updated_at": now,
        "schema_version": SCHEMA_VERSION,
    }
    _user_prep_recipes_ref(uid).document(rid).set(doc)
    doc["id"] = rid
    return doc


def update_recipe(uid: str, rid: str, body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ref = _user_prep_recipes_ref(uid).document(rid)
    snap = ref.get()
    if not snap.exists:
        return None
    update: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            raise ValueError("name cannot be empty")
        update["name"] = name
    if "prep_type" in body:
        pt = (body["prep_type"] or "").strip()
        if pt not in common_preserves_service.VALID_PREP_TYPES:
            raise ValueError("invalid prep_type")
        update["prep_type"] = pt
    if "ready_after_hours" in body:
        v = int(body["ready_after_hours"] or 0)
        if v < 0:
            raise ValueError("ready_after_hours must be >= 0")
        update["ready_after_hours"] = v
    if "shelf_life_days" in body:
        v = int(body["shelf_life_days"] or 0)
        if v <= 0:
            raise ValueError("shelf_life_days must be > 0")
        update["shelf_life_days"] = v
    if "servings" in body:
        v = int(body["servings"] or 0)
        if v < 1:
            raise ValueError("servings must be >= 1")
        update["servings"] = v
    if "ingredients" in body:
        update["ingredients"] = _normalize_ingredients(body["ingredients"])
    if "notes" in body:
        update["notes"] = (body["notes"] or "").strip()
    ref.update(update)
    out = ref.get().to_dict() or {}
    out["id"] = rid
    return out


def delete_recipe(uid: str, rid: str) -> bool:
    ref = _user_prep_recipes_ref(uid).document(rid)
    if not ref.get().exists:
        return False
    ref.delete()
    return True
