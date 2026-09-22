#!/usr/bin/env python3
"""Compare tournament-based Laya routing with CASE using localized examples.

The Laya run is independent from Resonus. CASE is optional and is enabled with
--case-url. Every source command is covered at least once before --requests is
used to extend the benchmark.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import resource
import statistics
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any


LANGUAGES = ("en", "ru", "de", "fr", "es", "it", "pt")
LayaAgent: Any = None


@dataclass(frozen=True)
class Command:
    key: str
    command_id: str
    surface: str
    base_type: str
    brief: str
    description: str
    examples: dict[str, tuple[str, ...]]


@dataclass(frozen=True)
class Query:
    key: str
    language: str
    text: str


def load_commands(roots: list[Path]) -> list[Command]:
    commands: list[Command] = []
    seen: set[str] = set()
    for root in roots:
        for path in sorted(root.rglob("llm.json")):
            document = json.loads(path.read_text(encoding="utf-8"))
            metadata = document.get("root", {})
            surface = str(metadata.get("surface") or path.parent.name)
            base_type = str(metadata.get("baseType") or surface)
            actions = document.get("actions", {})
            for command_id, definition in actions.items():
                if not isinstance(definition, dict):
                    continue
                examples = definition.get("examples", {})
                localized = {
                    language: tuple(
                        phrase.strip()
                        for phrase in examples.get(language, [])
                        if isinstance(phrase, str) and phrase.strip()
                    )
                    for language in LANGUAGES
                }
                if not any(localized.values()):
                    continue
                # IDs can overlap between modules. The root surface is part of
                # the expected answer so collisions remain distinguishable.
                key = f"{surface}:{command_id}"
                if key in seen:
                    continue
                seen.add(key)
                commands.append(Command(
                    key, command_id, surface, base_type,
                    str(definition.get("brief", command_id)),
                    str(definition.get("description", definition.get("brief", command_id))),
                    localized,
                ))
    if not commands:
        raise RuntimeError("no commands with localized examples were found")
    return commands


def make_queries(commands: list[Command], requests: int, seed: int) -> list[Query]:
    if requests < 1:
        raise ValueError("requests must be positive")
    rng = random.Random(seed)
    by_command: dict[str, list[Query]] = defaultdict(list)
    seen_texts: set[str] = set()
    for command in commands:
        for language in LANGUAGES:
            for phrase in command.examples[language]:
                text = phrase.strip()
                if text and text not in seen_texts:
                    seen_texts.add(text)
                    by_command[command.key].append(Query(command.key, language, text))
    if not seen_texts:
        raise RuntimeError("no localized examples were found")

    # Start with one distinct example per command so a short benchmark still
    # measures the whole catalog instead of whichever commands shuffle first.
    command_keys = list(by_command)
    rng.shuffle(command_keys)
    covered = [rng.choice(by_command[key]) for key in command_keys]
    remaining = [
        query
        for key, queries_for_command in by_command.items()
        for query in queries_for_command
        if query not in covered
    ]
    rng.shuffle(remaining)
    pool = covered + remaining
    if requests > len(pool):
        raise ValueError(
            f"requested {requests} queries, but only {len(pool)} unique example texts are available"
        )
    return pool[:requests]


def chunks(items: list[Command], size: int) -> list[list[Command]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def laya_choice(agent: Any, query: Query, candidates: list[Command], level: str) -> tuple[str, float]:
    labels = {f"c{index}": command for index, command in enumerate(candidates)}
    criteria: dict[str, str] = {}
    for label, command in labels.items():
        examples = command.examples.get(query.language) or command.examples.get("en") or ()
        sample = "; ".join(examples[:3])
        if level == "group":
            criteria[label] = f"{command.base_type}; surface {command.surface}; examples: {sample}"
        else:
            criteria[label] = f"{command.brief}; {command.description}; examples: {sample}"
    result = agent.predict(
        {"text": query.text, "language": query.language},
        {"choice": {
            "type": "choice",
            "instructions": "Which option best matches the user's requested command?",
            "criteria": criteria,
        }},
    )
    answer = result["answers"]["choice"]
    selected = labels.get(answer["choice"])
    if selected is None:
        raise RuntimeError(f"Laya returned an unknown option: {answer}")
    return selected.key, float(answer.get("confidence", 0.0))


def choose_tournament(agent: Any, query: Query, candidates: list[Command], level: str) -> tuple[str, float]:
    """Keep each choice question below Laya's documented ~20-option limit."""
    if len(candidates) <= 18:
        return laya_choice(agent, query, candidates, level)
    winners: list[tuple[str, float]] = []
    for group in chunks(candidates, 18):
        winners.append(laya_choice(agent, query, group, level))
    winner_commands = [next(command for command in candidates if command.key == key) for key, _ in winners]
    return laya_choice(agent, query, winner_commands, level)


def run_laya_with_commands(agent: Any, commands: list[Command], queries: list[Query]) -> dict[str, Any]:
    by_key = {command.key: command for command in commands}
    durations: list[float] = []
    group_hits = command_hits = end_to_end = 0
    confidence: list[float] = []
    per_language: Counter[str] = Counter()
    per_language_hits: Counter[str] = Counter()
    errors: list[dict[str, str]] = []
    for query in queries:
        started = time.perf_counter()
        try:
            command_key, command_confidence = choose_tournament(
                agent, query, commands, "command"
            )
        except Exception as error:  # keep the benchmark running and report bad cases
            if len(errors) < 20:
                errors.append({"expected": query.key, "language": query.language, "error": str(error)})
            durations.append((time.perf_counter() - started) * 1000)
            continue
        durations.append((time.perf_counter() - started) * 1000)
        expected = by_key[query.key]
        command_ok = command_key == expected.key
        group_ok = by_key[command_key].base_type == expected.base_type
        group_hits += int(group_ok)
        command_hits += int(command_ok)
        end_to_end += int(group_ok and command_ok)
        confidence.append(command_confidence)
        per_language[query.language] += 1
        per_language_hits[query.language] += int(command_ok)
        if not command_ok and len(errors) < 20:
            errors.append({"expected": query.key, "language": query.language, "got": command_key, "text": query.text})
    count = len(queries)
    return {
        "requests": count,
        "group_accuracy": group_hits / count if count else 0.0,
        "command_accuracy": command_hits / count if count else 0.0,
        "end_to_end_accuracy": end_to_end / count if count else 0.0,
        "mean_confidence": statistics.mean(confidence) if confidence else 0.0,
        "latency_ms": percentiles(durations),
        "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 2),
        "language_accuracy": {
            language: per_language_hits[language] / per_language[language]
            for language in sorted(per_language)
        },
        "errors": errors,
    }


def percentiles(values: list[float]) -> dict[str, float]:
    if not values:
        return {"p50": 0.0, "p95": 0.0, "p99": 0.0, "max": 0.0}
    ordered = sorted(values)
    def at(fraction: float) -> float:
        return round(ordered[min(len(ordered) - 1, int((len(ordered) - 1) * fraction))], 2)
    return {"p50": at(0.50), "p95": at(0.95), "p99": at(0.99), "max": round(max(ordered), 2)}


def call_json(url: str, method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=body, method=method, headers={"content-type": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def run_case(base_url: str, commands: list[Command], queries: list[Query]) -> dict[str, Any]:
    sections: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for command in commands:
        sections[command.surface].append({
            "id": command.command_id,
            "examples": {language: list(values) for language, values in command.examples.items() if values},
        })
    context_key = f"compare-laya-{os.getpid()}-{time.time_ns()}"
    call_json(f"{base_url.rstrip('/')}/contexts", "POST", {
        "key": context_key,
        "sections": [{"id": surface, "commands": values} for surface, values in sorted(sections.items())],
    })
    hits = 0
    durations: list[float] = []
    errors: list[dict[str, str]] = []
    for query in queries:
        started = time.perf_counter()
        try:
            result = call_json(f"{base_url.rstrip('/')}/route", "POST", {"context": context_key, "text": query.text})
            got = result.get("command")
            expected = next(command for command in commands if command.key == query.key)
            if got == expected.command_id:
                hits += 1
            elif len(errors) < 20:
                errors.append({"expected": query.key, "got": str(got), "text": query.text})
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as error:
            if len(errors) < 20:
                errors.append({"expected": query.key, "error": str(error)})
        durations.append((time.perf_counter() - started) * 1000)
    return {"requests": len(queries), "command_accuracy": hits / len(queries), "latency_ms": percentiles(durations), "errors": errors}


def load_laya(path: Path, device: str) -> Any:
    global LayaAgent
    try:
        import laya
    except ImportError as error:
        raise RuntimeError("install dependencies first: .venv-laya/bin/pip install laya") from error
    return laya.load(str(path), device=device)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roots", nargs="*", type=Path, default=[
        Path("/home/alexstorm/distrib/business/converged/modules/surfaces"),
        Path("/home/alexstorm/distrib/business/club/modules/surfaces"),
    ])
    parser.add_argument("--laya-multilingual", type=Path, default=Path("models/laya/multilingual"))
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--requests", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=20260921)
    parser.add_argument("--case-url")
    parser.add_argument("--report", type=Path, default=Path("test/laya-comparison.json"))
    args = parser.parse_args()

    commands = load_commands(args.roots)
    queries = make_queries(commands, args.requests, args.seed)
    if not args.laya_multilingual.is_dir():
        raise SystemExit("local multilingual Laya checkpoint is missing")

    agent = load_laya(args.laya_multilingual, args.device)
    multi_result = run_laya_with_commands(agent, commands, queries)
    report: dict[str, Any] = {
        "commands": len(commands),
        "surfaces": len({command.surface for command in commands}),
        "base_types": len({command.base_type for command in commands}),
        "queries": len(queries),
        "laya_multilingual": multi_result,
    }
    if args.case_url:
        report["case"] = run_case(args.case_url, commands, queries)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print("verdict: this is an 18-option tournament; compare command_accuracy and latency with CASE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
