#!/usr/bin/env python3
"""Load-test CASE routing with multilingual noisy paraphrases."""

from __future__ import annotations

import argparse
import json
import os
import random
import statistics
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any


NOISE: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "en": (("please", "could you", "kindly", "for me"), ("please", "right now", "when you can", "if possible")),
    "ru": (("пожалуйста", "можешь", "если не сложно", "для меня"), ("пожалуйста", "сейчас", "когда сможешь", "если можно")),
    "de": (("bitte", "kannst du", "sofort", "für mich"), ("bitte", "jetzt", "wenn möglich", "kurz")),
    "es": (("por favor", "puedes", "si puedes", "para mí"), ("por favor", "ahora", "cuando puedas", "si es posible")),
    "fr": (("s'il te plaît", "peux-tu", "si possible", "pour moi"), ("s'il te plaît", "maintenant", "quand tu peux", "rapidement")),
    "it": (("per favore", "puoi", "se puoi", "per me"), ("per favore", "adesso", "quando puoi", "se possibile")),
    "pt": (("por favor", "pode", "se puder", "para mim"), ("por favor", "agora", "quando puder", "se possível")),
}


@dataclass(frozen=True)
class Case:
    command: str
    language: str
    source: str
    query: str


def read_examples(path: str) -> tuple[list[dict[str, Any]], list[Case]]:
    with open(path, encoding="utf-8") as stream:
        source = json.load(stream)
    if not isinstance(source, dict):
        raise ValueError("example.json must contain an object keyed by command id")

    commands: list[dict[str, Any]] = []
    examples: list[Case] = []
    for command_id, definition in source.items():
        localized = definition.get("examples") if isinstance(definition, dict) else None
        if not isinstance(localized, dict):
            raise ValueError(f"{command_id}: expected examples object keyed by language")
        all_examples: list[str] = []
        for language, phrases in localized.items():
            if language not in NOISE:
                raise ValueError(f"unsupported language in example.json: {language}")
            if not isinstance(phrases, list) or not all(isinstance(item, str) for item in phrases):
                raise ValueError(f"{command_id}/{language}: expected a list of strings")
            all_examples.extend(phrases)
            for phrase in phrases:
                examples.append(Case(command_id, language, phrase, ""))
        commands.append({"id": command_id, "examples": all_examples})
    return commands, examples


def noisy_query(case: Case, rng: random.Random) -> str:
    prefixes, suffixes = NOISE[case.language]
    prefix = rng.choice(prefixes)
    suffix = rng.choice(suffixes)
    variants = (
        f"{prefix}, {case.source}, {suffix}",
        f"{prefix} {case.source} {suffix}",
        f"{prefix}, could you {case.source}, {suffix}" if case.language == "en" else f"{prefix}, {case.source}, {suffix}",
    )
    query = rng.choice(variants).strip()
    if query.casefold() == case.source.casefold():
        query = f"{prefix} {case.source} {suffix}"
    return query


def call_json(url: str, method: str, payload: dict[str, Any] | None = None, timeout: float = 60.0) -> tuple[int, dict[str, Any], float]:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"content-type": "application/json"} if body is not None else {},
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as error:
        raw = error.read()
        status = error.code
    elapsed_ms = (time.perf_counter() - started) * 1000
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        decoded = {"error": raw[:200].decode("utf-8", errors="replace")}
    return status, decoded, elapsed_ms


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int((len(ordered) - 1) * fraction))
    return ordered[index]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("CASE_URL", "http://127.0.0.1:18000"))
    parser.add_argument("--examples", default="/home/alexstorm/distrib/business/rd/case/test/example.json")
    parser.add_argument("--requests", type=int, default=1000)
    parser.add_argument("--workers", type=int, default=1, help="parallel clients; CASE itself handles requests sequentially")
    parser.add_argument("--seed", type=int, default=20260920)
    args = parser.parse_args()
    if args.requests < 1 or args.workers < 1:
        parser.error("--requests and --workers must be positive")

    commands, source_cases = read_examples(args.examples)
    context_key = f"loadtest-{os.getpid()}-{time.time_ns()}"
    base_url = args.url.rstrip("/")

    status, health, _ = call_json(f"{base_url}/healthz", "GET")
    if status != 200 or health.get("ok") is not True:
        print(f"ERROR: CASE is not healthy: HTTP {status} {health}", file=sys.stderr)
        return 2

    status, loaded, load_ms = call_json(
        f"{base_url}/contexts",
        "POST",
        {"key": context_key, "commands": commands},
    )
    if status != 200:
        print(f"ERROR: context upload failed: HTTP {status} {loaded}", file=sys.stderr)
        return 2

    rng = random.Random(args.seed)
    cases = [
        Case(case.command, case.language, case.source, noisy_query(case, rng))
        for case in (source_cases[i % len(source_cases)] for i in range(args.requests))
    ]
    rng.shuffle(cases)

    def run(case: Case) -> tuple[Case, int, dict[str, Any], float]:
        status_code, response, elapsed = call_json(
            f"{base_url}/route",
            "POST",
            {"context": context_key, "text": case.query},
        )
        return case, status_code, response, elapsed

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(run, cases))
    total_s = time.perf_counter() - started

    latencies = [elapsed for _, status_code, _, elapsed in results if status_code == 200]
    correct = 0
    http_errors = 0
    wrong: list[tuple[Case, dict[str, Any]]] = []
    decisions: dict[str, int] = {}
    for case, status_code, response, _ in results:
        if status_code != 200:
            http_errors += 1
            continue
        decision = str(response.get("decision", "<missing>"))
        decisions[decision] = decisions.get(decision, 0) + 1
        if response.get("command") == case.command:
            correct += 1
        elif len(wrong) < 10:
            wrong.append((case, response))

    accuracy = correct / len(results) if results else 0.0
    throughput = len(results) / total_s if total_s else 0.0
    print(f"context: {context_key}")
    print(f"commands: {len(commands)}, source phrases: {len(source_cases)}, generated requests: {len(results)}")
    print(f"context upload: {status} in {load_ms:.1f} ms ({loaded.get('vectors', '?')} vectors)")
    print(f"correct: {correct}/{len(results)} ({accuracy * 100:.2f}%), HTTP errors: {http_errors}")
    print(f"decisions: {json.dumps(decisions, ensure_ascii=False, sort_keys=True)}")
    print(f"latency ms: p50={percentile(latencies, 0.50):.1f}, p95={percentile(latencies, 0.95):.1f}, p99={percentile(latencies, 0.99):.1f}, max={max(latencies, default=0):.1f}")
    print(f"throughput: {throughput:.2f} requests/s, workers: {args.workers}")

    if wrong:
        print("sample errors:")
        for case, response in wrong:
            print(f"  [{case.language}] expected={case.command} got={response.get('command')} decision={response.get('decision')}: {case.query}")

    if http_errors == 0 and accuracy >= 0.95:
        verdict = "EXCELLENT: at least 95% of noisy multilingual requests routed correctly."
    elif http_errors == 0 and accuracy >= 0.85:
        verdict = "GOOD: routing is usable, but some noisy multilingual cases need review."
    elif http_errors == 0 and accuracy >= 0.70:
        verdict = "WEAK: the model handles the basic set, but noisy paraphrases expose ambiguity."
    else:
        verdict = "FAIL: availability or routing quality is below an acceptable level."
    print(f"verdict: {verdict}")
    return 0 if http_errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
