"""Unit tests for natural-language expiry parsing (pure function, no Firestore)."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.services.nl_expiry import parse_expiry

NOW = datetime(2026, 4, 23, 12, 0, 0)  # Thursday, 23 Apr 2026


@pytest.mark.parametrize(
    "text",
    [
        "no expiry", "no exp", "n/a", "na", "none", "never",
        "doesn't expire", "does not expire", "-", "", "  ",
    ],
)
def test_no_expiry_tokens(text):
    dt, source = parse_expiry(text, now=NOW)
    assert dt is None
    assert source == "none"


def test_none_input():
    dt, source = parse_expiry(None, now=NOW)
    assert dt is None
    assert source is None


def test_today():
    dt, source = parse_expiry("today", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == NOW.date()


def test_tomorrow():
    dt, source = parse_expiry("tomorrow", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == (NOW + timedelta(days=1)).date()


def test_tmrw_abbreviation():
    dt, source = parse_expiry("tmrw", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == (NOW + timedelta(days=1)).date()


def test_in_n_days():
    dt, source = parse_expiry("in 5 days", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == (NOW + timedelta(days=5)).date()


def test_n_days_no_in():
    dt, source = parse_expiry("3 days", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == (NOW + timedelta(days=3)).date()


def test_in_n_weeks():
    dt, source = parse_expiry("in 2 weeks", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == (NOW + timedelta(weeks=2)).date()


def test_next_week():
    dt, source = parse_expiry("next week", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == (NOW + timedelta(days=7)).date()


def test_next_friday_from_thursday():
    # NOW is Thursday → next Friday is tomorrow+N, weekday fri=4, thu=3, so +1
    dt, source = parse_expiry("next friday", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.weekday() == 4


def test_next_weekday_on_same_day_skips_ahead():
    # NOW is Thursday (weekday=3). "next thursday" should be +7, not today.
    dt, source = parse_expiry("next thursday", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.date() == (NOW + timedelta(days=7)).date()


def test_iso_date():
    dt, source = parse_expiry("2026-05-15", now=NOW)
    assert source == "iso"
    assert dt == datetime(2026, 5, 15, 23, 59, 59)


def test_iso_date_slashes():
    dt, source = parse_expiry("2026/05/15", now=NOW)
    assert source == "iso"
    assert dt == datetime(2026, 5, 15, 23, 59, 59)


def test_dd_mm_yyyy():
    # Malaysian/European ordering
    dt, source = parse_expiry("30/04/2026", now=NOW)
    assert source == "iso"
    assert dt == datetime(2026, 4, 30, 23, 59, 59)


def test_dd_mon_yyyy():
    dt, source = parse_expiry("30 Apr 2026", now=NOW)
    assert source == "iso"
    assert dt == datetime(2026, 4, 30, 23, 59, 59)


def test_month_full_name():
    dt, source = parse_expiry("30 april 2026", now=NOW)
    assert source == "iso"
    assert dt == datetime(2026, 4, 30, 23, 59, 59)


def test_invalid_date_returns_none():
    dt, source = parse_expiry("2026-13-45", now=NOW)  # invalid month + day
    assert dt is None


def test_end_of_month():
    dt, source = parse_expiry("end of month", now=NOW)
    assert source == "nlp"
    assert dt is not None
    assert dt.month == NOW.month
    assert dt.year == NOW.year
    # Last day of April 2026 = 30
    assert dt.day == 30


def test_case_insensitive():
    dt1, _ = parse_expiry("TOMORROW", now=NOW)
    dt2, _ = parse_expiry("Tomorrow", now=NOW)
    dt3, _ = parse_expiry("tomorrow", now=NOW)
    assert dt1 == dt2 == dt3


def test_whitespace_trimming():
    dt, source = parse_expiry("  tomorrow  ", now=NOW)
    assert source == "nlp"
    assert dt is not None


def test_unparseable_returns_none():
    dt, source = parse_expiry("sometime soon-ish maybe", now=NOW)
    assert dt is None
