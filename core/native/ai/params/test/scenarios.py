#!/usr/bin/env python3
"""Acceptance scenarios for query + format + variants extraction."""

from __future__ import annotations

import argparse
import json
import urllib.request


FORMAT = {
    "time_range": {"type": "string"},
    "date_from": {"type": "string"},
    "date_to": {"type": "string"},
    "status": {"type": "string"},
    "company_type": {"type": "string"},
    "city_id": {"type": "integer"},
}
VARIANTS = {
    "time_range": ["today", "yesterday", "last_hour", "last_7_days", "last_30_days"],
    "status": ["new", "active", "done", "analyzed"],
    "company_type": ["cnc", "saas", "agency"],
}
SCENARIOS = [
    ("Покажи компании за сегодня", {"time_range": "today"}),
    ("Покажи компании за последнюю неделю", {"time_range": "last_7_days"}),
    ("Покажи компании за последний час", {"time_range": "last_hour"}),
    ("Компании за последний месяц со статусом analyzed", {"time_range": "last_30_days", "status": "analyzed"}),
    ("Активные cnc-компании за последнюю неделю", {"time_range": "last_7_days", "status": "active", "company_type": "cnc"}),
    ("Компании со статусом active в городе 1860735 за сегодня", {"time_range": "today", "status": "active", "city_id": 1860735}),
    ("Компании с 2026-09-01 по 2026-09-15", {"date_from": "2026-09-01", "date_to": "2026-09-15"}),
    ("Компании типа saas за месяц и со статусом done", {"time_range": "last_30_days", "status": "done", "company_type": "saas"}),
    ("Новые компании за сегодня в городе 42", {"time_range": "today", "status": "new", "city_id": 42}),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:18001")
    args = parser.parse_args()
    passed = 0
    for query, expected in SCENARIOS:
        payload = json.dumps({"query": query, "format": FORMAT, "variants": VARIANTS}, ensure_ascii=False).encode()
        request = urllib.request.Request(f"{args.url}/params", data=payload, method="POST", headers={"content-type": "application/json"})
        with urllib.request.urlopen(request, timeout=60) as response:
            actual = json.loads(response.read())
        ok = actual == expected
        passed += ok
        print(json.dumps({"ok": ok, "query": query, "expected": expected, "actual": actual}, ensure_ascii=False))
    print(json.dumps({"passed": passed, "total": len(SCENARIOS), "accuracy": passed / len(SCENARIOS)}))
    return 0 if passed == len(SCENARIOS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
