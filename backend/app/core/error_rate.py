"""Error-rate alerting middleware.

Tracks 5xx responses in a sliding 5-min window. Logs ERROR when the rate
exceeds the threshold and sample size is large enough to be meaningful.

Defaults: window=300s, threshold=5%, min_sample=20.
Override via env: ERROR_RATE_WINDOW_SEC, ERROR_RATE_THRESHOLD, ERROR_RATE_MIN_SAMPLE.

Logs are de-duped: once a high-rate alert fires, it won't fire again for
`alert_cooldown_sec` (default 60s) to avoid log spam.
"""

import logging
import os
import time
from collections import deque
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger("api.error_rate")

WINDOW_SEC = int(os.environ.get("ERROR_RATE_WINDOW_SEC", "300"))
THRESHOLD = float(os.environ.get("ERROR_RATE_THRESHOLD", "0.05"))
MIN_SAMPLE = int(os.environ.get("ERROR_RATE_MIN_SAMPLE", "20"))
ALERT_COOLDOWN_SEC = int(os.environ.get("ERROR_RATE_COOLDOWN_SEC", "60"))


class ErrorRateMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self._events: deque[tuple[float, int]] = deque()
        self._lock = Lock()
        self._last_alert_at: float = 0.0

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        self._record(response.status_code)
        return response

    def _record(self, status_code: int):
        now = time.time()
        with self._lock:
            self._events.append((now, status_code))
            cutoff = now - WINDOW_SEC
            while self._events and self._events[0][0] < cutoff:
                self._events.popleft()

            total = len(self._events)
            if total < MIN_SAMPLE:
                return

            errors = sum(1 for _, sc in self._events if sc >= 500)
            rate = errors / total
            if rate < THRESHOLD:
                return

            if now - self._last_alert_at < ALERT_COOLDOWN_SEC:
                return
            self._last_alert_at = now

            logger.error(
                "error_rate_alert",
                extra={
                    "rate_pct": round(rate * 100, 2),
                    "errors": errors,
                    "total": total,
                    "window_sec": WINDOW_SEC,
                    "threshold_pct": round(THRESHOLD * 100, 2),
                },
            )
