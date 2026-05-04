"""Per-user rate limiting — token bucket in process memory.

Two layers:
  1. Per-endpoint dependency `rate_limit(writes_per_min=N)` — granular, used on
     write endpoints to enforce per-user fairness within an authenticated tier.
  2. Global ASGI middleware `RateLimitMiddleware` — coarse anonymous-vs-auth
     budget, applied to every request. Protects the daily Firestore quota
     from a single misbehaving client without doing token verification or a
     Firestore lookup on the hot path.

Single-process token bucket (in-memory). Good enough for one Render service or
gunicorn with a single worker. For multi-worker / multi-instance deployments,
swap _buckets for a Redis-backed implementation.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.auth import UserInfo, get_current_user

_buckets: dict[str, deque] = defaultdict(deque)


def _prune(key: str, window_sec: float = 60.0) -> None:
    """Remove timestamps older than the window from a bucket."""
    cutoff = time.time() - window_sec
    bucket = _buckets[key]
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


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Global coarse rate limit, applied to every request.

    Identity bucket is the bearer-token tail (NOT verified) when
    `Authorization: Bearer <token>` is present, otherwise the client IP
    (X-Forwarded-For first, falling back to socket peer).

    NOT a security control — auth still happens at the route level. This is
    a quota-protection mechanism: without it, one buggy or malicious client
    can blow the daily Firestore read quota in minutes, taking down the app
    for everyone until midnight UTC.

    Args:
        anonymous_limit: requests/minute for unauthenticated identities (IP-keyed).
        authenticated_limit: requests/minute for clients that present a bearer
            token (token-tail-keyed). Coarse — per-tier fairness happens at the
            route level via the `rate_limit()` dependency.
        exempt_paths: path prefixes that bypass the limiter (health checks, static).
    """

    def __init__(
        self,
        app,
        anonymous_limit: int = 20,
        authenticated_limit: int = 200,
        exempt_paths: tuple[str, ...] = (
            "/health", "/static", "/assets", "/sw.js", "/manifest.webmanifest",
            # Public read for AboutPage. Cheap (≤50-doc Firestore read), no
            # auth, equivalent to static content. Rate-limiting it would
            # break the donation page for users behind shared NATs.
            "/api/external-links",
        ),
    ):
        super().__init__(app)
        self.anonymous_limit = anonymous_limit
        self.authenticated_limit = authenticated_limit
        self.exempt_paths = exempt_paths

    def _identity(self, request: Request) -> tuple[str, int]:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
            # Use the last 16 chars as a bucket key. Not verified — but two
            # attackers would have to share the exact same token tail to share
            # a bucket, which is statistically impossible for Firebase tokens.
            return f"auth:{token[-16:]}", self.authenticated_limit
        xff = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        ip = xff or (request.client.host if request.client else "unknown")
        return f"anon:{ip}", self.anonymous_limit

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        for exempt in self.exempt_paths:
            if path.startswith(exempt):
                return await call_next(request)

        key, limit = self._identity(request)
        _prune(key)
        bucket = _buckets[key]
        if len(bucket) >= limit:
            retry_after = int(bucket[0] + 60 - time.time()) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded ({limit}/min). Retry in {retry_after}s.",
                },
                headers={"Retry-After": str(max(retry_after, 1))},
            )
        bucket.append(time.time())
        return await call_next(request)
