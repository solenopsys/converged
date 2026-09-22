#!/usr/bin/env python3
"""Benchmark Jev against the localized command examples used by compare_laya."""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

from compare_laya import Command, Query, chunks, load_commands, make_queries, percentiles


DEFAULT_KEY_FILE = Path("/home/alexstorm/distrib/business/confs/rd.dev")
DEFAULT_API_URL = "https://api.typesafe.ai/v1/systemone"


def read_api_key(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == "jev_key" and value.strip():
            return value.strip()
    raise ValueError(f"jev_key was not found in {path}")


def jev_choice(
    api_url: str,
    api_key: str,
    query: Query,
    candidates: list[Command],
    level: str,
    timeout: float,
) -> tuple[str, float]:
    criteria: dict[str, str] = {}
    for command in candidates:
        examples = command.examples.get(query.language) or command.examples.get("en") or ()
        sample = "; ".join(examples[:3])
        if level == "group":
            criteria[command.key] = f"{command.base_type}; surface {command.surface}; examples: {sample}"
        else:
            criteria[command.key] = f"{command.brief}; {command.description}; examples: {sample}"

    payload = {
        "state": {"text": query.text, "language": query.language},
        "model": "jev-latest",
        "questions": {
            "command": {
                "type": "choice",
                "instructions": "Which option best matches the user's requested command?",
                "criteria": criteria,
            }
        },
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        api_url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Jev HTTP {error.code}: {detail}") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Jev request failed: {error}") from error

    answer = result.get("answers", {}).get("command", {})
    selected = answer.get("choice")
    if selected not in criteria:
        raise RuntimeError(f"Jev returned an unknown option: {answer}")
    return str(selected), float(answer.get("confidence", 0.0))


def choose_tournament(
    api_url: str,
    api_key: str,
    query: Query,
    candidates: list[Command],
    level: str,
    timeout: float,
) -> tuple[str, float]:
    if len(candidates) <= 18:
        return jev_choice(api_url, api_key, query, candidates, level, timeout)
    winners: list[tuple[str, float]] = []
    for group in chunks(candidates, 18):
        winners.append(jev_choice(api_url, api_key, query, group, level, timeout))
    winner_commands = [next(command for command in candidates if command.key == key) for key, _ in winners]
    return jev_choice(api_url, api_key, query, winner_commands, level, timeout)


def run_jev(
    api_url: str,
    api_key: str,
    commands: list[Command],
    queries: list[Query],
    timeout: float,
) -> dict[str, Any]:
    by_key = {command.key: command for command in commands}
    durations: list[float] = []
    command_hits = 0
    confidence: list[float] = []
    per_language: Counter[str] = Counter()
    per_language_hits: Counter[str] = Counter()
    errors: list[dict[str, str]] = []
    for query in queries:
        started = time.perf_counter()
        try:
            command_key, command_confidence = choose_tournament(
                api_url, api_key, query, commands, "command", timeout
            )
        except Exception as error:  # keep the benchmark running and report bad cases
            if len(errors) < 20:
                errors.append({"expected": query.key, "language": query.language, "error": str(error)})
            durations.append((time.perf_counter() - started) * 1000)
            continue
        durations.append((time.perf_counter() - started) * 1000)
        expected = by_key[query.key]
        command_ok = command_key == expected.key
        command_hits += int(command_ok)
        confidence.append(command_confidence)
        per_language[query.language] += 1
        per_language_hits[query.language] += int(command_ok)
        if not command_ok and len(errors) < 20:
            errors.append({"expected": query.key, "language": query.language, "got": command_key, "text": query.text})
    count = len(queries)
    return {
        "requests": count,
        "command_accuracy": command_hits / count if count else 0.0,
        "mean_confidence": statistics.mean(confidence) if confidence else 0.0,
        "latency_ms": percentiles(durations),
        "language_accuracy": {
            language: per_language_hits[language] / per_language[language]
            for language in sorted(per_language)
        },
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roots", nargs="*", type=Path, default=[
        Path("/home/alexstorm/distrib/business/converged/modules/surfaces"),
        Path("/home/alexstorm/distrib/business/club/modules/surfaces"),
    ])
    parser.add_argument("--key-file", type=Path, default=DEFAULT_KEY_FILE)
    parser.add_argument("--api-key", default=os.environ.get("JEV_API_KEY"))
    parser.add_argument("--api-url", default=os.environ.get("JEV_API_URL", DEFAULT_API_URL))
    parser.add_argument("--requests", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=20260921)
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--report", type=Path, default=Path("test/jev-comparison.json"))
    args = parser.parse_args()
    if args.requests < 1:
        parser.error("--requests must be positive")

    commands = load_commands(args.roots)
    queries = make_queries(commands, args.requests, args.seed)
    api_key = args.api_key or read_api_key(args.key_file)
    result = run_jev(args.api_url, api_key, commands, queries, args.timeout)
    report = {
        "model": "jev-latest",
        "commands": len(commands),
        "surfaces": len({command.surface for command in commands}),
        "base_types": len({command.base_type for command in commands}),
        "queries": len(queries),
        "jev": result,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
