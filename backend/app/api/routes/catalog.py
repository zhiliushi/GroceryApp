"""Catalog API — user's personal name catalog (reusable item names).

GET    /api/catalog                          — List/search my catalog entries
GET    /api/catalog/lookup/barcode/{barcode} — Find my catalog entry by barcode
GET    /api/catalog/{name_norm}              — Get a single catalog entry (with history)
PATCH  /api/catalog/{name_norm}              — Update display_name / barcode / defaults
POST   /api/catalog/{name_norm}/merge        — Merge into another catalog entry (reparents events)
DELETE /api/catalog/{name_norm}              — Delete (blocked if active_purchases > 0)
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import UserInfo, get_current_user
from app.core.rate_limit import rate_limit
from app.schemas.catalog import CatalogMergeRequest, CatalogUpdate
from app.services import catalog_service, purchase_event_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

@router.get("")
async def list_catalog(
    q: str = Query("", description="autocomplete prefix"),
    sort_by: str = Query("last_purchased_at"),
    limit: int = Query(50, ge=1, le=500),
    cursor: Optional[str] = Query(None, description="opaque cursor from previous response's next_cursor"),
    user: UserInfo = Depends(get_current_user),
):
    """List the authenticated user's catalog entries with cursor pagination.

    Response: `{count, items, next_cursor}`. `next_cursor` is null when no more
    pages exist. Pass it as the `cursor` param on the next request to continue.
    """
    return catalog_service.list_catalog(
        user_id=user.uid,
        query=q,
        limit=limit,
        sort_by=sort_by,
        cursor=cursor,
    )


@router.get("/lookup/barcode/{barcode}")
async def lookup_by_barcode(barcode: str, user: UserInfo = Depends(get_current_user)):
    """Find this user's catalog entry matching the barcode. Returns {entry: null} if none."""
    entry = catalog_service.find_by_barcode(user.uid, barcode)
    return {"entry": entry}


@router.get("/{name_norm}")
async def get_catalog_entry(name_norm: str, user: UserInfo = Depends(get_current_user)):
    """Get a single catalog entry including recent purchase history."""
    entry = catalog_service.get_catalog_entry(user.uid, name_norm)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Catalog entry '{name_norm}' not found")
    history_page = purchase_event_service.list_purchases(
        user_id=user.uid,
        catalog_name_norm=name_norm,
        limit=20,
    )
    entry["history"] = history_page["items"]
    return entry


@router.get("/{name_norm}/overview")
async def get_catalog_overview(name_norm: str, user: UserInfo = Depends(get_current_user)):
    """Phase E full overview: counters + lifetime breakdown + waste rate +
    movement timeline + split lineage tree + price history per store.

    Read-only aggregation over the catalog's full event history.
    """
    from app.core.exceptions import NotFoundError
    from app.services import catalog_overview_service

    try:
        return catalog_overview_service.compute_overview(user.uid, name_norm)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Phase G — similarity + transfer-history flow
# ---------------------------------------------------------------------------


@router.get("/_/similar")
async def get_similar(
    q: str = Query("", min_length=0),
    limit: int = Query(3, ge=1, le=20),
    exclude: Optional[str] = Query(None, description="exclude this name_norm"),
    user: UserInfo = Depends(get_current_user),
):
    """Top-N catalog rows matching `q` by name similarity. Powers the
    QuickAddModal "did you mean?" suggestions."""
    from app.services import catalog_similarity_service
    return {
        "matches": catalog_similarity_service.find_similar(
            user.uid, q, limit=limit, exclude_name_norm=exclude,
        ),
    }


@router.get("/_/duplicates")
async def get_likely_duplicates(
    user: UserInfo = Depends(get_current_user),
):
    """Likely-duplicate catalog pairs for the Settings → Merge Nudge widget."""
    from app.services import catalog_similarity_service
    return {"pairs": catalog_similarity_service.find_likely_duplicates(user.uid)}


@router.post("/_/transfer/preview")
async def preview_transfer(body: dict, user: UserInfo = Depends(get_current_user)):
    """Preview a catalog transfer (event count, unit mismatch warning, etc).

    Body: {"src": "name_norm_a", "dst": "name_norm_b"}
    """
    from app.core.exceptions import NotFoundError, ValidationError
    from app.services import catalog_transfer_service

    src = (body or {}).get("src", "").strip()
    dst = (body or {}).get("dst", "").strip()
    if not src or not dst:
        raise HTTPException(status_code=400, detail="src and dst are required")
    try:
        return catalog_transfer_service.preview_transfer(user.uid, src, dst)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/_/transfer/execute")
async def execute_transfer(body: dict, user: UserInfo = Depends(get_current_user)):
    """Execute a catalog transfer. Source is consolidated into destination,
    soft-deleted via audit log, and reversible for 7 days.

    Body: {"src": "name_norm_a", "dst": "name_norm_b", "confirm": true}
    """
    from app.core.exceptions import NotFoundError, ValidationError
    from app.services import catalog_transfer_service

    if not bool((body or {}).get("confirm", False)):
        raise HTTPException(status_code=400, detail="Must pass {confirm: true}")
    src = (body or {}).get("src", "").strip()
    dst = (body or {}).get("dst", "").strip()
    if not src or not dst:
        raise HTTPException(status_code=400, detail="src and dst are required")
    try:
        return catalog_transfer_service.execute_transfer(user.uid, src, dst, actor_uid=user.uid)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/_/transfer/{transfer_id}/reverse")
async def reverse_transfer_endpoint(
    transfer_id: str,
    user: UserInfo = Depends(get_current_user),
):
    """Reverse a transfer within the 7-day reversal window."""
    from app.core.exceptions import ConflictError, NotFoundError
    from app.services import catalog_transfer_service

    try:
        return catalog_transfer_service.reverse_transfer(user.uid, transfer_id, actor_uid=user.uid)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/_/transfer/log")
async def list_transfer_log(
    limit: int = Query(20, ge=1, le=100),
    user: UserInfo = Depends(get_current_user),
):
    from app.services import catalog_transfer_service
    return {"transfers": catalog_transfer_service.list_transfers(user.uid, limit=limit)}


# ---------------------------------------------------------------------------
# Update / merge / delete
# ---------------------------------------------------------------------------

@router.patch("/{name_norm}", dependencies=[Depends(rate_limit(60))])
async def update_catalog_entry(
    name_norm: str,
    data: CatalogUpdate,
    user: UserInfo = Depends(get_current_user),
):
    """Partial update. Pass barcode='' to unlink."""
    updates = data.model_dump(exclude_unset=True)
    return catalog_service.update_catalog_entry(user.uid, name_norm, updates)


@router.post("/{name_norm}/merge", dependencies=[Depends(rate_limit(60))])
async def merge_catalog_entry(
    name_norm: str,
    data: CatalogMergeRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Merge this catalog entry into the target (target_name_norm). Reparents all events."""
    return catalog_service.merge_catalog(
        user_id=user.uid,
        src_name_norm=name_norm,
        dst_name_norm=data.target_name_norm,
    )


@router.delete("/{name_norm}", dependencies=[Depends(rate_limit(60))])
async def delete_catalog_entry(
    name_norm: str,
    force: bool = Query(False, description="force delete even if active_purchases > 0"),
    user: UserInfo = Depends(get_current_user),
):
    """Delete a catalog entry. Blocked if it has active purchases unless force=true."""
    catalog_service.delete_catalog_entry(user.uid, name_norm, force=force)
    return {"success": True, "name_norm": name_norm}
