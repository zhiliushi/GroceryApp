"""
OCR Manager — cascading provider orchestrator.

Reads provider config from Firestore, tries each enabled provider in priority
order, tracks usage, and logs every attempt for admin monitoring.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime

from .base import (
    OcrProvider,
    OcrProviderError,
    ProviderAttempt,
    ScanResult,
)
from .google_vision import GoogleVisionProvider
from .mindee_provider import MindeeProvider
from .tesseract_provider import TesseractProvider

logger = logging.getLogger(__name__)


class OcrManager:
    """Cascading OCR manager that tries providers in configured order."""

    # Registry of all known providers (instantiated lazily)
    PROVIDER_CLASSES: dict[str, type[OcrProvider]] = {
        "google_vision": GoogleVisionProvider,
        "mindee": MindeeProvider,
        "tesseract": TesseractProvider,
    }

    # Per-provider timeout in seconds
    TIMEOUTS: dict[str, float] = {
        "google_vision": 15.0,
        "mindee": 15.0,
        "tesseract": 30.0,
    }

    def __init__(self):
        self._providers: dict[str, OcrProvider] = {}

    def _get_provider(self, key: str, config: dict) -> OcrProvider:
        """Lazily instantiate a provider with config."""
        if key not in self._providers:
            cls = self.PROVIDER_CLASSES.get(key)
            if not cls:
                raise ValueError(f"Unknown provider: {key}")

            if key == "mindee":
                from app.core.config import settings
                self._providers[key] = MindeeProvider(
                    api_key=getattr(settings, "MINDEE_API_KEY", "") or "",
                )
            elif key == "google_vision":
                self._providers[key] = GoogleVisionProvider(
                    timeout=self.TIMEOUTS.get(key, 15.0),
                )
            else:
                self._providers[key] = cls()

        return self._providers[key]

    async def scan(
        self,
        image_bytes: bytes,
        ocr_config: dict,
        usage: dict,
    ) -> ScanResult:
        """Process a receipt image through the cascading provider chain.

        Args:
            image_bytes: The receipt image data.
            ocr_config: Provider config from Firestore ``app_config/ocr``.
            usage: Current usage stats from Firestore ``app_config/ocr_usage``.

        Returns:
            ScanResult with parsed data or error details.
        """
        result = ScanResult()

        if not ocr_config.get("enabled", True):
            result.error = "ocr_disabled"
            return result

        providers = ocr_config.get("providers", [])
        # Sort by priority
        providers = sorted(providers, key=lambda p: p.get("priority", 99))

        # Items-based cascade: if a provider succeeds but finds 0 items,
        # store it as fallback and try the next provider. If a later provider
        # finds items, use it. Otherwise, use the fallback (success with no data)
        # rather than reporting "all_providers_failed."
        fallback_attempt: ProviderAttempt | None = None

        for provider_config in providers:
            key = provider_config.get("key", "")
            if not provider_config.get("enabled", False):
                result.attempts.append(ProviderAttempt(
                    provider=key,
                    status="skipped",
                    error_type="disabled",
                    error_message="Provider is disabled",
                ))
                continue

            # Check API key requirement
            if key in ("google_vision", "mindee"):
                if not provider_config.get("api_key_set", False):
                    result.attempts.append(ProviderAttempt(
                        provider=key,
                        status="skipped",
                        error_type="key_missing",
                        error_message="API key not configured",
                    ))
                    continue

            # Check monthly quota
            monthly_limit = provider_config.get("monthly_limit", -1)
            if monthly_limit > 0:
                current_month = datetime.utcnow().strftime("%Y-%m")
                provider_usage = usage.get(key, {})
                if provider_usage.get("month") == current_month:
                    count = provider_usage.get("count", 0)
                    if count >= monthly_limit:
                        result.attempts.append(ProviderAttempt(
                            provider=key,
                            status="skipped",
                            error_type="quota_exceeded",
                            error_message=f"Monthly limit reached ({count}/{monthly_limit})",
                        ))
                        continue

            # Try this provider
            attempt = await self._try_provider(key, image_bytes, provider_config)
            result.attempts.append(attempt)

            if attempt.status == "success":
                if attempt.items_found == 0 and fallback_attempt is None:
                    # Success but no items — store as fallback, try next provider
                    fallback_attempt = attempt
                    continue

                # Success with items (or we already have a fallback) — use this result
                result.success = True
                result.provider_used = key
                result.data = attempt._receipt_data  # type: ignore[attr-defined]
                return result

        # All providers exhausted — use fallback if available
        if fallback_attempt is not None:
            result.success = True
            result.provider_used = fallback_attempt.provider
            result.data = fallback_attempt._receipt_data  # type: ignore[attr-defined]
            return result

        result.error = "all_providers_failed"
        return result

    async def _try_provider(
        self,
        key: str,
        image_bytes: bytes,
        config: dict,
    ) -> ProviderAttempt:
        """Attempt extraction with a single provider."""
        start = time.monotonic()
        timeout = self.TIMEOUTS.get(key, 15.0)

        try:
            provider = self._get_provider(key, config)
        except Exception as exc:
            return ProviderAttempt(
                provider=key,
                status="error",
                error_type="init_failed",
                error_message=str(exc),
            )

        try:
            receipt_data = await asyncio.wait_for(
                provider.extract(image_bytes),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            duration = int((time.monotonic() - start) * 1000)
            return ProviderAttempt(
                provider=key,
                status="error",
                duration_ms=duration,
                error_type="timeout",
                error_message=f"Timed out after {timeout}s",
            )
        except OcrProviderError as exc:
            duration = int((time.monotonic() - start) * 1000)
            return ProviderAttempt(
                provider=key,
                status="error",
                duration_ms=duration,
                error_type=exc.error_type,
                error_message=exc.message,
            )
        except Exception as exc:
            duration = int((time.monotonic() - start) * 1000)
            logger.exception("Unexpected error from provider %s", key)
            return ProviderAttempt(
                provider=key,
                status="error",
                duration_ms=duration,
                error_type="unexpected",
                error_message=str(exc),
            )

        duration = int((time.monotonic() - start) * 1000)
        attempt = ProviderAttempt(
            provider=key,
            status="success",
            duration_ms=duration,
            items_found=len(receipt_data.items),
            confidence=receipt_data.confidence,
        )
        # Attach receipt data to the attempt so scan() can retrieve it
        attempt._receipt_data = receipt_data  # type: ignore[attr-defined]
        return attempt
