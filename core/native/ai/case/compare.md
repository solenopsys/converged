# CASE and Laya Comparison

Date: 2026-09-21

## Side-by-Side Summary

| Point | CASE | Laya multilingual |
|---|---|---|
| Routing approach | Vector retrieval over indexed examples | Typed choice classification |
| Commands in catalog | 174 | 174 |
| Surfaces | 36 | 36 |
| Indexed examples | 3,654 | Not indexed; passed as one choice prompt |
| Requests measured | 1,000 | 174 |
| Unique commands in measured sample | 174 | 108 |
| Exact command accuracy | 100.00% (1,000/1,000) | 0.57% (1/174) |
| Base-type/group accuracy | Not measured separately | 5.17% |
| P50 latency | 7.9 ms | 675.18 ms |
| P95 latency | 10.0 ms | 702.72 ms |
| P99 latency | 10.7 ms | 716.32 ms |
| Maximum latency | 14.4 ms | Not recorded |
| Memory after test | 482.6 MB container, about 492 MB RSS | About 2.18 GB RSS on CPU |
| Large flat catalog support | Yes | No; 174 choices is outside the practical option budget |
| Resonus integration | Not used in this test | Not used in this test |

For the tested command-routing workload, CASE is both more accurate and faster.
Laya was tested as a direct flat replacement, with all command options in one
choice question.

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

## Laya Baseline

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

The Laya result is effectively random for 174 choices:

```text
1 / 174 = 0.574%
```

This is a baseline for the question: can Laya replace CASE with one flat
classification request over the complete command catalog? The result is no.

It is not a test of a multi-stage Laya design with fewer choices per question.
The Laya model documentation recommends keeping choice questions below
approximately 20 options. A multi-stage design would require additional model
calls and would be a different architecture from the current CASE router.

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

The Laya sample contains 174 requests but 108 unique expected commands. A
balanced Laya benchmark should explicitly include at least one request for
every command.

The CASE result is based on exact command matching and `EXECUTE` output. It
does not measure whether an application-specific command payload contains valid
parameters.

## Reproduction

CASE and Laya test code:

- `test/load_api.py`
- `test/compare_laya.py`

The local multilingual model is stored at:

```text
models/laya/multilingual
```

The model reference is the [Laya multilingual model card](https://huggingface.co/convaiinnovations/laya-multilingual).
