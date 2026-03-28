"""
Background scheduler for periodic tasks.

Currently runs:
- foodbank scrape_and_update every 10 minutes
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler

from app.services import foodbank_service, exchange_rate_service

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def start():
    """Start the background scheduler. Safe to call multiple times."""
    global _scheduler
    if _scheduler is not None:
        logger.warning("Scheduler already running — skipping start")
        return

    _scheduler = BackgroundScheduler()

    # Foodbank refresh every 10 minutes
    _scheduler.add_job(
        foodbank_service.scrape_and_update,
        "interval",
        minutes=10,
        id="foodbank_scrape",
        name="Foodbank scrape & update",
        replace_existing=True,
    )

    # Exchange rate refresh daily
    _scheduler.add_job(
        exchange_rate_service.fetch_and_cache_rates,
        "interval",
        hours=24,
        id="exchange_rate_update",
        name="Exchange rate daily update",
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
