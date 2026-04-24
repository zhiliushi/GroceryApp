"""Per-user rate limiting — token bucket in process memory.

Simple sliding window: max N actions per 60s window per uid. Good enough for
single-process deployments (Render free tier). For multi-worker deployments,
replace with Redis-backed implementation.

Usage:
    from app.core.rate_limit import rate_limit
    from app.core.auth import get_current_user, UserInfo
    from fastapi import Depends

    @router.post("/items", dependencies=[Depends(rate_limit(writes_per_min=60))])
    async def create_item(user: UserInfo = Depends(get_current_user)): ...
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Depends, HTTPException, Request

from app.core.auth import UserInfo, get_current_user

_buckets: dict[str, deque] = defaultdict(deque)


def _prune(uid: str, window_sec: float = 60.0) -> None:
    """Remove timestamps older than the window from uid's bucket."""
    cutoff = time.time() - window_sec
    bucket = _buckets[uid]
    while bucket and bucket[0] < cutoff:
        bucket.popleft()


def rate_limit(writes_per_min: int = 60) -> Callable:
    """Return a FastAPI dependency that enforces per-user rate limit.

    Counts only the user's UID. Admin/anonymous requests bypass the limit.

    Args:
        writes_per_min: Max actions allowed per 60-second window.

    Raises:
        HTTPException 429: When the user has exceeded the limit.
    """

    def _checker(request: Request, user: UserInfo = Depends(get_current_user)):
        uid = user.uid
        _prune(uid)
        bucket = _buckets[uid]
        if len(bucket) >= writes_per_min:
            # Oldest timestamp + 60s = when they can retry
            retry_after = int(bucket[0] + 60 - time.time()) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded ({writes_per_min}/min). Retry in {retry_after}s.",
                headers={"Retry-After": str(max(retry_after, 1))},
            )
        bucket.append(time.time())

    return _checker


def reset_all() -> None:
    """Test helper — clear all buckets."""
    _buckets.clear()
