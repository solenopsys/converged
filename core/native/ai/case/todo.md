# CASE TODO

## 1. Implement Hierarchical Neighbor Consensus

Implement the algorithm described in `alg.md`:

- keep `section_id` and `command_id` metadata for every example vector;
- search globally for the top 20 nearest example vectors;
- group those neighbors by section;
- score groups using top-k similarity plus a sublinear support bonus;
- select the command from the original neighbors inside the winning section;
- return both `section` and `command`;
- add multilingual and hard-negative evaluation cases;
- compare the result with the current flat nearest-vector baseline.

The first parameters to evaluate are:

```text
M = 20
k = 3
alpha = 0.25
```

Do not treat these values as final until they are validated by the test set.

## 2. Evaluate a More Compact Encoder Model

Keep Granite 97M as the current baseline and evaluate smaller multilingual
embedding models for a future runtime reduction.

For each candidate model:

- export and run the model through the same native embedding pipeline;
- measure RAM usage and p50/p95 latency;
- run the same multilingual noisy routing corpus;
- measure command accuracy, section accuracy, false `EXECUTE`, `UNKNOWN`, and
  `AMBIGUOUS` rates;
- compare the candidate against Granite before considering fine-tuning.

The compact model can replace Granite only if it materially reduces resource
usage without degrading routing safety and multilingual accuracy.
