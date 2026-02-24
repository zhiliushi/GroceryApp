"""Price record service — manages price records across users via Firestore."""

import logging
import time
from typing import Optional, List, Dict, Any, Tuple

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


def list_price_records(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    barcode: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Collection group query on 'price_records'.
    Filter by barcode or search (product_name, store_name).
    Sort by created_at desc. Extract user_id from doc path."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection_group('price_records').stream():
            data = doc.to_dict()
            data['id'] = doc.id
            # Extract user_id from path: users/{uid}/price_records/{id}
            path_parts = doc.reference.path.split('/')
            data['user_id'] = path_parts[1] if len(path_parts) >= 4 else 'unknown'

            if barcode and data.get('barcode') != barcode:
                continue
            if search:
                q = search.lower()
                name = (data.get('product_name') or '').lower()
                store = (data.get('store_name') or '').lower()
                bc = (data.get('barcode') or '').lower()
                if q not in name and q not in store and q not in bc:
                    continue
            results.append(data)
    except Exception as e:
        logger.warning("Failed to list price records: %s", e)
        return [], 0

    results.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    total = len(results)
    return results[offset:offset + limit], total


def get_record_count() -> int:
    """Total count of price records across all users."""
    db = _get_db()
    count = 0
    try:
        for _ in db.collection_group('price_records').stream():
            count += 1
    except Exception as e:
        logger.warning("Failed to count price records: %s", e)
    return count


def delete_record(user_id: str, record_id: str) -> bool:
    """Delete a single price record."""
    db = _get_db()
    try:
        ref = db.collection('users').document(user_id).collection('price_records').document(record_id)
        ref.delete()
        return True
    except Exception as e:
        logger.warning("Failed to delete price record %s/%s: %s", user_id, record_id, e)
        return False


def delete_records_batch(records: List[Dict[str, str]]) -> int:
    """Batch delete price records. Each item: {user_id, record_id}. Returns count deleted."""
    db = _get_db()
    deleted = 0
    # Firestore batch limit is 500
    batch_size = 500
    for i in range(0, len(records), batch_size):
        chunk = records[i:i + batch_size]
        batch = db.batch()
        for rec in chunk:
            ref = db.collection('users').document(rec['user_id']).collection('price_records').document(rec['record_id'])
            batch.delete(ref)
        try:
            batch.commit()
            deleted += len(chunk)
        except Exception as e:
            logger.warning("Batch delete failed at chunk %d: %s", i, e)
    return deleted
