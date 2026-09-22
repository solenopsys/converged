# CASE, Laya, and Jev Comparison

Date: 2026-09-22

## Side-by-Side Summary

| Point | CASE | Laya multilingual | Jev |
|---|---|---|---|
| Routing approach | Vector retrieval over indexed examples | Typed choice classification with 18-option tournament (corrected) | Typed choice classification with 18-option tournament |
| Commands in catalog | 174 | 174 | 174 |
| Surfaces | 36 | 36 | 36 |
| Indexed examples | 3,654 | Not indexed; passed in tournament criteria | Not indexed; passed in choice criteria |
| Requests measured | 1,000 | 100 (corrected tournament) | 100 (pre-fix sample) |
| Unique commands in measured sample | 174 | 100 | 79 |
| Exact command accuracy | 100.00% (1,000/1,000) | 43.00% (43/100) | 100.00% (100/100) |
| Base-type/group accuracy | Not measured separately | 51.00% (51/100) | Not measured separately |
| P50 latency | 7.9 ms | 1,583.21 ms | 10,435.08 ms |
| P95 latency | 10.0 ms | 1,768.86 ms | 11,468.27 ms |
| P99 latency | 10.7 ms | 1,888.06 ms | 11,775.93 ms |
| Maximum latency | 14.4 ms | 1,934.80 ms | 11,981.28 ms |
| Memory after test | 482.6 MB container, about 492 MB RSS | 4,487.34 MB peak RSS | Not measured |
| Large flat catalog support | Yes | No; evaluated through 18-option tournament | No; evaluated through 18-option tournament |
| Resonus integration | Not used in this test | Not used in this test | Not used in this test |

The old Laya numbers below came from a direct flat replacement, with all
command options in one choice question. They are retained as a baseline, not
as a fair comparison with Jev.

## Current CASE Test

The current container was rebuilt with batched context encoding. The context
encoder processes at most 32 examples per ONNX Runtime call.

Test data:

- 174 commands
- 36 surfaces
- 35 base types
- 3,654 indexed examples
- all seven configured languages: `en`, `ru`, `de`, `fr`, `es`, `it`, `pt`
- 1,000 routing requests

Measured result:

| Metric | Result |
|---|---:|
| Exact command matches | 1,000 / 1,000 |
| Accuracy | 100.00% |
| HTTP errors | 0 |
| P50 latency | 7.9 ms |
| P95 latency | 10.0 ms |
| P99 latency | 10.7 ms |
| Maximum latency | 14.4 ms |
| Container memory after test | 482.6 MB |
| Process RSS after test | about 492 MB |

The container was measured with `podman stats`. Process RSS was read from
`/proc/1/status` inside the container. Memory remained stable after context
upload and after all 1,000 requests.

The current test command was:

```bash
python3 test/load_api.py \
  --url http://127.0.0.1:18000 \
  --requests 1000 \
  --workers 1
```

## Laya Flat Baseline (Historical)

The local multilingual Laya checkpoint was tested separately with the same
command catalog and localized examples.

Laya received one flat choice question containing 174 command options. Each
option used the command `brief`, `description`, and localized examples.

| Metric | Result |
|---|---:|
| Requests | 174 |
| Unique commands represented | 108 |
| Exact command matches | 1 / 174 |
| Accuracy | 0.57% |
| Group/base-type accuracy | 5.17% |
| P50 latency on CPU | 675.18 ms |
| P95 latency on CPU | 702.72 ms |
| P99 latency on CPU | 716.32 ms |
| Peak process RSS during test | about 2.18 GB |

The old Laya result is effectively random for 174 choices:

```text
1 / 174 = 0.574%
```

This is only a baseline for the question: can Laya replace CASE with one flat
classification request over the complete command catalog? It is not an
equivalent comparison with the Jev tournament.

It is not a test of the corrected multi-stage Laya design with fewer choices per question.
The Laya model documentation recommends keeping choice questions below
approximately 20 options. A multi-stage design would require additional model
calls and would be a different architecture from the current CASE router.

## Corrected Tournament Comparison

The comparison test now uses the same tournament shape for Laya and Jev:

- each query is evaluated in groups of at most 18 commands;
- one winner is selected from each group;
- a final choice is made among the group winners.

Both tests use the same query generator. It removes duplicate example texts,
selects at least one example for every command before filling the requested
sample, and fails instead of repeating examples when the requested count is
larger than the available unique texts. The corrected Laya result uses 100
unique requests and 100 distinct commands: 43/100 exact command matches and
51/100 correct base types. Peak Python process RSS was 4,487.34 MB.

The Jev result shown below is also a 100-request run, but it was generated
before the query-generator fix and covered only 79 commands. Jev must be
rerun with the corrected generator for a strictly matched comparison.

| Metric | Laya result |
|---|---:|
| Requests | 100 |
| Unique commands represented | 100 |
| Exact command matches | 43 / 100 |
| Accuracy | 43.00% |
| Group/base-type accuracy | 51.00% |
| Mean confidence | 0.465588 |
| P50 latency on CPU | 1,583.21 ms |
| P95 latency on CPU | 1,768.86 ms |
| P99 latency on CPU | 1,888.06 ms |
| Maximum latency | 1,934.80 ms |
| Peak process RSS | 4,487.34 MB |

## Jev Test

Jev was tested with the same 174-command catalog. Because the catalog is larger than the practical
choice size, each query used ten groups of up to 18 commands followed by one
final choice among the group winners. One measured request therefore required
11 calls to the TypeSafe API.

Test data:

- 174 commands
- 36 surfaces
- 35 base types
- 100 routing requests
- 79 unique commands represented in the pre-fix sample
- all seven configured languages: `en`, `ru`, `de`, `fr`, `es`, `it`, `pt`
- model: `jev-latest`

| Metric | Result |
|---|---:|
| Exact command matches | 100 / 100 |
| Accuracy | 100.00% |
| Mean confidence | 0.9997 |
| HTTP/API errors | 0 |
| P50 latency | 10,435.08 ms |
| P95 latency | 11,468.27 ms |
| P99 latency | 11,775.93 ms |
| Maximum latency | 11,981.28 ms |

The latency includes all 11 sequential JEV calls required by the tournament.

## Why The Results Differ

CASE performs vector retrieval. Each user phrase is encoded and compared with
all indexed examples. Adding commands increases the index, but does not turn
the command catalog into one large classification head.

Laya performs typed choice classification. In the tested configuration, all
174 commands compete inside one choice question. This exceeds the practical
option budget of the model, so the command labels cannot be compared reliably.

CASE is the better fit for the current routing problem. Laya could still be
evaluated for a narrow later task, such as selecting parameters after CASE has
selected a surface and command.

## Test Limitations

The CASE test uses the examples as its index, so it measures retrieval quality
for the current context. A separate holdout test with new user-written
paraphrases is required to measure generalization.

The benchmark examples are still catalog examples, not independently written
holdout paraphrases. A separate holdout benchmark is required to measure
generalization to genuinely new user requests.

The CASE result is based on exact command matching and `EXECUTE` output. It
does not measure whether an application-specific command payload contains valid
parameters.

## Reproduction

CASE and Laya test code:

- `test/load_api.py`
- `test/compare_laya.py`
- `test/compare_jev.py`

The local multilingual model is stored at:

```text
models/laya/multilingual
```

The model reference is the [Laya multilingual model card](https://huggingface.co/convaiinnovations/laya-multilingual).
