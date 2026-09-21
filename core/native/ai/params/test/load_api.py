#!/usr/bin/env python3
"""Load-test PARAMS extraction and report latency percentiles."""

from __future__ import annotations

import argparse
import json
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor


def call(url: str, payload: bytes, timeout: float) -> tuple[int, dict, float, str | None]:
    started = time.perf_counter()
    try:
        request = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={"content-type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            value = json.loads(response.read().decode("utf-8"))
            return response.status, value, (time.perf_counter() - started) * 1000, None
    except (OSError, ValueError, urllib.error.HTTPError) as error:
        return 0, {}, (time.perf_counter() - started) * 1000, str(error)


def percentile(values: list[float], fraction: float) -> float:
    return values[min(len(values) - 1, max(0, int(len(values) * fraction) - 1))]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:18001")
    parser.add_argument("--requests", type=int, default=50)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--timeout", type=float, default=60)
    args = parser.parse_args()
    if args.requests < 1 or args.workers < 1:
        parser.error("--requests and --workers must be positive")

    with urllib.request.urlopen(f"{args.url}/healthz", timeout=args.timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"health check failed: HTTP {response.status}")

    payload = json.dumps({
        "query": "Open order 157",
        "format": {"orderNumber": {"type": "integer"}},
        "variants": {},
    }).encode("utf-8")
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda _: call(f"{args.url}/params", payload, args.timeout), range(args.requests)))
    elapsed = time.perf_counter() - started
    latencies = sorted(result[2] for result in results)
    errors = [result for result in results if result[0] != 200 or result[1] != {"orderNumber": 157}]
    report = {
        "requests": args.requests,
        "workers": args.workers,
        "elapsed_s": round(elapsed, 3),
        "throughput_rps": round(args.requests / elapsed, 2),
        "errors": len(errors),
        "mean_ms": round(statistics.mean(latencies), 2),
        "p50_ms": round(percentile(latencies, 0.50), 2),
        "p95_ms": round(percentile(latencies, 0.95), 2),
        "p99_ms": round(percentile(latencies, 0.99), 2),
        "max_ms": round(max(latencies), 2),
    }
    print(json.dumps(report, indent=2))
    if errors:
        print(f"first_error={errors[0]}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
