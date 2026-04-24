"""Background scheduler for periodic tasks.

Legacy jobs:
  - foodbank scrape (10 min)
  - exchange rates (daily)
  - legacy grocery_items expiry check (daily 09:00 UTC)

Phase 3 (refactor) jobs — all feature-flag-guarded:
  - reminder_scan              daily 08:00 UTC    (7/14/21d nudges for no-expiry purchases)
  - purchase_expiry_check      daily 09:15 UTC    (flag expired purchase events)
  - catalog_cleanup            weekly Mon 03:00 UTC (delete 365d-stale unlinked catalog entries)
  - country_backfill           every 6 hours       (fill missing country_code on products)
  - catalog_analysis_refresh   weekly Sun 02:00 UTC (rebuild admin aggregation cache)
  - milestone_check            hourly              (emit 50/100/500/1000 milestone insights)
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.services import (
    catalog_analysis_service,
    catalog_service,
    country_service,
    exchange_rate_service,
    foodbank_service,
    insights_service,
    inventory_service,
    nudge_service,
    purchase_event_service,
)

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def start():
    """Start the background scheduler. Safe to call multiple times."""
    global _scheduler
    if _scheduler is not None:
        logger.warning("Scheduler already running — skipping start")
        return

    _scheduler = BackgroundScheduler()

    # ---------------- Legacy jobs (unchanged) ----------------

    _scheduler.add_job(
        foodbank_service.scrape_and_update,
        "interval",
        minutes=10,
        id="foodbank_scrape",
        name="Foodbank scrape & update",
        replace_existing=True,
    )

    _scheduler.add_job(
        exchange_rate_service.fetch_and_cache_rates,
        "interval",
        hours=24,
        id="exchange_rate_update",
        name="Exchange rate daily update",
        replace_existing=True,
    )

    # Legacy grocery_items expiry check — kept until migration complete
    _scheduler.add_job(
        inventory_service.flag_expired_items,
        "cron",
        hour=9,
        minute=0,
        id="expiry_check",
        name="Legacy grocery_items expiry check",
        replace_existing=True,
    )

    # ---------------- Phase 3 refactor jobs ------------------

    # Daily nudge scan for active purchases without expiry (7/14/21-day buckets)
    _scheduler.add_job(
        nudge_service.scan_reminders,
        "cron",
        hour=8,
        minute=0,
        id="reminder_scan",
        name="Nudge scan (7/14/21-day reminders)",
        replace_existing=True,
    )

    # Daily purchase-event expiry flagging (collection-group scan)
    _scheduler.add_job(
        purchase_event_service.flag_expired_purchases,
        "cron",
        hour=9,
        minute=15,
        id="purchase_expiry_check",
        name="Daily purchase_event expiry flag",
        replace_existing=True,
    )

    # Weekly catalog cleanup — delete stale no-barcode, no-active, >365d entries
    _scheduler.add_job(
        _catalog_cleanup_job,
        "cron",
        day_of_week="mon",
        hour=3,
        minute=0,
        id="catalog_cleanup",
        name="Weekly catalog cleanup",
        replace_existing=True,
    )

    # Country backfill for products missing country_code (every 6 hours)
    _scheduler.add_job(
        _country_backfill_job,
        "interval",
        hours=6,
        id="country_backfill",
        name="Product country_code backfill",
        replace_existing=True,
    )

    # Weekly admin catalog analysis cache refresh
    _scheduler.add_job(
        _catalog_analysis_refresh_job,
        "cron",
        day_of_week="sun",
        hour=2,
        minute=0,
        id="catalog_analysis_refresh",
        name="Admin catalog analysis cache",
        replace_existing=True,
    )

    # Hourly milestone scan (50/100/500/1000)
    _scheduler.add_job(
        insights_service.check_milestones,
        "interval",
        hours=1,
        id="milestone_check",
        name="Milestone insight trigger",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("Background scheduler started with %d jobs", len(_scheduler.get_jobs()))


def stop():
    """Shutdown the scheduler gracefully."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Background scheduler stopped")


# ---------------------------------------------------------------------------
# Feature-flag-guarded job wrappers
# ---------------------------------------------------------------------------


def _catalog_cleanup_job():
    """Weekly catalog cleanup — guarded by `catalog_cleanup` flag."""
    from app.core.feature_flags import is_enabled

    if not is_enabled("catalog_cleanup"):
        logger.info("scheduler.catalog_cleanup: skipped (flag off)")
        return
    try:
        count = catalog_service.cleanup_unlinked_catalog(dry_run=False)
        logger.info("scheduler.catalog_cleanup deleted=%d", count)
    except Exception as exc:
        logger.exception("scheduler.catalog_cleanup failed: %s", exc)


def _country_backfill_job():
    """Fill missing country_code on products — guarded by `barcode_country_autodetect`."""
    from app.core.feature_flags import is_enabled

    if not is_enabled("barcode_country_autodetect"):
        logger.info("scheduler.country_backfill: skipped (flag off)")
        return
    try:
        count = country_service.backfill_country_for_products()
        if count:
            logger.info("scheduler.country_backfill filled=%d", count)
    except Exception as exc:
        logger.exception("scheduler.country_backfill failed: %s", exc)


def _catalog_analysis_refresh_job():
    """Rebuild admin aggregation cache weekly."""
    try:
        result = catalog_analysis_service.refresh_cache()
        logger.info(
            "scheduler.catalog_analysis_refresh barcode_to_names=%d no_barcode=%d cleanup=%d",
            len(result.get("barcode_to_names") or []),
            len(result.get("no_barcode_names") or []),
            len(result.get("cleanup_preview") or []),
        )
    except Exception as exc:
        logger.exception("scheduler.catalog_analysis_refresh failed: %s", exc)
