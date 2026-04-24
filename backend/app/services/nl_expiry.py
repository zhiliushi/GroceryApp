"""Natural language expiry date parser.

Parses user-provided strings into datetime. Handles:
  - "tomorrow", "today", "yesterday"
  - "next week", "next month", "next Friday"
  - "in 3 days", "in 2 weeks"
  - "end of month", "end of week"
  - "no expiry", "doesn't expire", "n/a", "none", ""
  - ISO dates: "2026-04-30", "2026/04/30"
  - DD/MM/YYYY: "30/04/2026" (Malaysian/European)
  - DD-MMM-YYYY: "30 Apr 2026"
  - MMM YYYY: "Apr 2026" → first of month

Returns (datetime | None, source_tag) where source_tag is:
  - "nlp" for natural language parse
  - "iso" for structured date parse
  - "none" for explicit "no expiry"
  - None for failed parse
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Optional

# Tokens meaning "no expiry"
_NO_EXPIRY_TOKENS = {
    "no expiry", "no exp", "n/a", "na", "none", "never", "doesn't expire",
    "doesnt expire", "does not expire", "no expire", "—", "-", "",
}

# Relative day tokens
_RELATIVE_DAYS = {
    "today": 0,
    "tonight": 0,
    "tomorrow": 1,
    "tmrw": 1,
    "tmr": 1,
    "yesterday": -1,
    "day after tomorrow": 2,
}

# Weekday names → dow number (Monday=0)
_WEEKDAYS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

# Month names → month number
_MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


def parse_expiry(text: str, now: Optional[datetime] = None) -> tuple[Optional[datetime], Optional[str]]:
    """Parse a natural-language expiry string.

    Args:
        text: User input (any case, whitespace).
        now: Reference time for relative parsing. Defaults to datetime.utcnow().

    Returns:
        (datetime, source_tag) — datetime is None if text means "no expiry" OR parse failed.
        source_tag is "nlp" | "iso" | "none" | None.
    """
    if text is None:
        return None, None

    t = text.strip().lower()
    if t in _NO_EXPIRY_TOKENS:
        return None, "none"

    now = now or datetime.utcnow()

    # --- Relative day words ---
    if t in _RELATIVE_DAYS:
        return _end_of_day(now + timedelta(days=_RELATIVE_DAYS[t])), "nlp"

    # --- "next week", "next month" ---
    if t == "next week":
        return _end_of_day(now + timedelta(days=7)), "nlp"
    if t == "next month":
        # Approximation: 30 days out
        return _end_of_day(now + timedelta(days=30)), "nlp"
    if t in ("this week", "end of week"):
        # Sunday of current week
        days_until_sunday = (6 - now.weekday()) % 7
        return _end_of_day(now + timedelta(days=days_until_sunday or 7)), "nlp"
    if t in ("end of month",):
        last_day = _last_day_of_month(now.year, now.month)
        return datetime(now.year, now.month, last_day, 23, 59, 59), "nlp"

    # --- "in N days/weeks/months" ---
    m = re.match(r"^in\s+(\d+)\s+(day|days|week|weeks|month|months)$", t)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        if "day" in unit:
            return _end_of_day(now + timedelta(days=n)), "nlp"
        if "week" in unit:
            return _end_of_day(now + timedelta(weeks=n)), "nlp"
        if "month" in unit:
            return _end_of_day(now + timedelta(days=n * 30)), "nlp"

    # --- "N days/weeks/months" (without "in") ---
    m = re.match(r"^(\d+)\s+(day|days|week|weeks|month|months)$", t)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        if "day" in unit:
            return _end_of_day(now + timedelta(days=n)), "nlp"
        if "week" in unit:
            return _end_of_day(now + timedelta(weeks=n)), "nlp"
        if "month" in unit:
            return _end_of_day(now + timedelta(days=n * 30)), "nlp"

    # --- "next Friday" ---
    m = re.match(r"^next\s+(\w+)$", t)
    if m and m.group(1) in _WEEKDAYS:
        target_dow = _WEEKDAYS[m.group(1)]
        days_until = (target_dow - now.weekday()) % 7
        if days_until == 0:
            days_until = 7  # "next Friday" on a Friday means *next* Friday, not today
        return _end_of_day(now + timedelta(days=days_until)), "nlp"

    # --- Plain weekday name (Friday → next occurrence) ---
    if t in _WEEKDAYS:
        target_dow = _WEEKDAYS[t]
        days_until = (target_dow - now.weekday()) % 7 or 7
        return _end_of_day(now + timedelta(days=days_until)), "nlp"

    # --- ISO date: 2026-04-30, 2026/04/30, 2026.04.30 ---
    m = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$", t)
    if m:
        try:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return datetime(y, mo, d, 23, 59, 59), "iso"
        except ValueError:
            pass

    # --- DD/MM/YYYY or DD-MM-YYYY ---
    m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$", t)
    if m:
        d, mo, y_str = int(m.group(1)), int(m.group(2)), m.group(3)
        y = int(y_str) + 2000 if len(y_str) == 2 else int(y_str)
        try:
            return datetime(y, mo, d, 23, 59, 59), "iso"
        except ValueError:
            pass

    # --- "30 Apr 2026" / "30 April 2026" / "Apr 30 2026" ---
    m = re.match(r"^(\d{1,2})\s+([a-z]+)\s+(\d{4})$", t)
    if m:
        d, mon_str, y = int(m.group(1)), m.group(2), int(m.group(3))
        if mon_str in _MONTHS:
            try:
                return datetime(y, _MONTHS[mon_str], d, 23, 59, 59), "iso"
            except ValueError:
                pass

    m = re.match(r"^([a-z]+)\s+(\d{1,2})[,]?\s+(\d{4})$", t)
    if m:
        mon_str, d, y = m.group(1), int(m.group(2)), int(m.group(3))
        if mon_str in _MONTHS:
            try:
                return datetime(y, _MONTHS[mon_str], d, 23, 59, 59), "iso"
            except ValueError:
                pass

    # --- "Apr 2026" → first of month ---
    m = re.match(r"^([a-z]+)\s+(\d{4})$", t)
    if m and m.group(1) in _MONTHS:
        try:
            return datetime(int(m.group(2)), _MONTHS[m.group(1)], 1, 23, 59, 59), "iso"
        except ValueError:
            pass

    # Failed to parse
    return None, None


def _end_of_day(dt: datetime) -> datetime:
    """Return datetime at 23:59:59 of the given date."""
    return datetime(dt.year, dt.month, dt.day, 23, 59, 59)


def _last_day_of_month(year: int, month: int) -> int:
    """Return last day of a given month (handles leap years)."""
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    return (next_month - timedelta(days=1)).day
