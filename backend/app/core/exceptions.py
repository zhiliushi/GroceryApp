"""Domain exceptions for GroceryApp.

These are raised by services; FastAPI exception handlers in main.py map them
to appropriate HTTP responses. Keeps business logic decoupled from HTTP layer.
"""

from __future__ import annotations


class DomainError(Exception):
    """Base for all domain exceptions."""

    http_status: int = 500

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class NotFoundError(DomainError):
    """Requested resource does not exist. Maps to HTTP 404."""

    http_status = 404


class ConflictError(DomainError):
    """Resource conflict (e.g. duplicate key, barcode already linked). Maps to HTTP 409."""

    http_status = 409


class ValidationError(DomainError):
    """Invalid input (e.g. empty name, malformed date). Maps to HTTP 400."""

    http_status = 400


class PermissionError(DomainError):
    """User lacks permission for this action. Maps to HTTP 403."""

    http_status = 403


class FeatureDisabledError(DomainError):
    """Feature is disabled by admin toggle. Maps to HTTP 404 (to hide feature existence)."""

    http_status = 404


class RateLimitError(DomainError):
    """User exceeded rate limit. Maps to HTTP 429."""

    http_status = 429


class TransientError(DomainError):
    """Temporary failure (Firestore contention, network). Maps to HTTP 503 with retry hint."""

    http_status = 503
