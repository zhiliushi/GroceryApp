"""Slow Firestore query logging.

Wrap a hot-path Firestore call with `with timed_query("catalog.search"): ...`
or decorate a service function with `@timed("waste.health_score")`. Anything
exceeding `SLOW_QUERY_THRESHOLD_MS` logs a WARNING with the op name and ms.

Threshold default: 2000ms. Override via `SLOW_QUERY_THRESHOLD_MS` env var.
"""

import logging
import os
import time
from contextlib import contextmanager
from functools import wraps

logger = logging.getLogger("firestore.slow")

SLOW_QUERY_THRESHOLD_MS = int(os.environ.get("SLOW_QUERY_THRESHOLD_MS", "2000"))


@contextmanager
def timed_query(op_name: str, **extra):
    start = time.perf_counter()
    try:
        yield
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        if duration_ms >= SLOW_QUERY_THRESHOLD_MS:
            logger.warning(
                "slow_firestore_query",
                extra={"op": op_name, "duration_ms": duration_ms, **extra},
            )


def timed(op_name: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            with timed_query(op_name):
                return fn(*args, **kwargs)
        return wrapper
    return decorator
