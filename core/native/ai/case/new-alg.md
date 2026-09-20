# CASE: Language → Basket by Aggregate Support → Command

## 1. Language Selection

A separate component detects the language of the request. CASE uses only examples in the selected language. Uncertain language detection produces `AMBIGUOUS`; no examples in that language produces `UNKNOWN`.

Language detection and embedding generation are outside the scope of this example: it receives ready-made `language` and `query_vector` values. Language detection latency is measured separately.

## 2. Basket Weight: A Normalized Kernel Mixture

Data structure: `language → surface (basket) → command → example vectors`.

All embeddings come from the same model. Compare the query against every example in the selected language, without selecting a basket first or truncating the results to a global top 20. Each example creates a region of influence around its vector. A basket is evaluated by the combined influence of its examples at the query point.

### Contribution of One Example

```text
s(q, e) = dot(q, e) / (norm(q) × norm(e))
w(q, e) = exp((s(q, e) − 1) / tau)
```

`tau > 0` controls the neighborhood width. With a small `tau`, the closest examples dominate; a larger value allows a wider neighborhood to contribute. As `tau` approaches zero, selection approaches nearest-neighbor behavior.

Example with `tau = 0.05`:

| Cosine similarity | Contribution |
| --- | ---: |
| 0.95 | 0.367879 |
| 0.90 | 0.135335 |
| 0.85 | 0.049787 |
| 0.80 | 0.018316 |
| 0.60 | 0.000335 |

Several close matches add up; distant examples contribute little.

### Command Support and Basket Weight

```text
A(command) = sum(w(q, e) over the command examples) / number of its examples
B(surface) = sum(A(command) over the basket commands) / number of its commands
```

First average the contributions within each command, then average command support within the basket. This is neither a maximum nor a vote for a single best example.

Normalization removes the direct bonus for having more examples or commands. The model assumes that commands within a basket are equally likely and examples within a command have equal weight. Examples are treated as alternative representatives of an intent, not independent pieces of evidence.

Select the basket with the largest `B`. The approach follows the principle of kernel density estimation. For normalized vectors, this exponential kernel corresponds to a spherical kernel mixture with a shared concentration; the common normalization constant does not affect basket ranking. The general KDE principle and the importance of kernel bandwidth are described in the [SciPy documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gaussian_kde.html). This scheme is a specific proposed model for CASE, not proof that it outperforms alternatives on user requests.

## 3. Command Selection and Confidence Checks

After selecting the basket, use the original similarities of its examples:

```text
C(command) = max(s(q, e) over the command examples)
chosen_command = argmax(C(command) within the selected basket)
```

`A` contributes to the aggregate basket weight; `C` selects the action within that basket. These scores serve different purposes.

Checks:

```text
global_best = highest similarity across all examples in the selected language
surface_log_gap = log(B(top basket)) − log(B(runner-up basket))
command_gap = C(top command) − C(runner-up command in the selected basket)
```

Use the logarithm of the weight ratio for baskets and the cosine similarity difference for commands. They must not share a single threshold.

| Condition | Decision |
| --- | --- |
| No examples in the language, or global_best < unknown_threshold | UNKNOWN |
| surface_log_gap < log(surface_ratio) | AMBIGUOUS: clarify the basket |
| C(chosen_command) < execute_threshold | AMBIGUOUS: weak command match |
| command_gap < command_margin | AMBIGUOUS: clarify the action |
| All checks pass | EXECUTE |

If there is no competing candidate, skip its gap check. When the basket is ambiguous, do not return the selected surface as an established result. When the basket is clear but the command is ambiguous, the surface can be returned without an action.

Neither the basket weight nor its normalized share is a calibrated probability of a correct answer. An absolute similarity check is essential: even an unrelated request will have a winning candidate. Here, `EXECUTE` means a confident routing decision; parameters and execution conditions are checked separately.

## 4. Simple Python Example

No external dependencies are required. The vectors are artificial and two-dimensional: this example demonstrates the calculation, not embedding-model quality. For the query `[1, 0]`, `vector(s)` creates a unit vector whose cosine similarity to the query equals `s`.

The code computes log weights using log-sum-exp to avoid numerical precision problems when `tau` is small.

```python
from math import sqrt, exp, log


def vector(s):
    return [s, sqrt(1 - s * s)]


def cosine(a, b):
    if len(a) != len(b):
        raise ValueError("Vector dimensions differ")
    na = sqrt(sum(x * x for x in a))
    nb = sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        raise ValueError("Zero vector")
    return max(-1.0, min(1.0, sum(x*y for x, y in zip(a, b)) / (na*nb)))


def log_mean_exp(values):
    m = max(values)
    return m + log(sum(exp(v - m) for v in values) / len(values))


def make_index(a_peak=0.90, b_peaks=(0.87, 0.87, 0.87)):
    # Language -> basket -> command -> list of example vectors.
    # One example per command here to keep the arithmetic transparent.
    def basket(name, similarities):
        return {
            f"{name}.{i}": [vector(s)]
            for i, s in enumerate(similarities, 1)
        }
    return {
        "ru": {
            "A": basket("A", [a_peak] + [0.30] * 9),
            "B": basket("B", list(b_peaks) + [0.30] * 7),
        },
        # A perfect match in another language does not participate in the ru calculation.
        "en": {"C": {"C.1": [[1.0, 0.0]]}},
    }


def route(index, language, query, tau=0.05,
          unknown=0.65, execute=0.85,
          surface_ratio=1.5, command_margin=0.03):
    if tau <= 0 or surface_ratio <= 1 or command_margin <= 0:
        raise ValueError("Invalid parameters")
    log_baskets, command_scores = {}, {}
    for surface, commands in index.get(language, {}).items():
        if not commands or any(not examples for examples in commands.values()):
            raise ValueError("Each basket and command must be nonempty")
        log_supports = []
        command_scores[surface] = {}
        for command, examples in commands.items():
            sims = [cosine(query, e) for e in examples]
            # log(A): mean contribution of the command examples.
            log_supports.append(log_mean_exp([(s - 1) / tau for s in sims]))
            # C: best example for the subsequent action selection.
            command_scores[surface][command] = max(sims)
        # log(B): mean support across the commands in the basket.
        log_baskets[surface] = log_mean_exp(log_supports)

    if not log_baskets:
        return {"decision": "UNKNOWN", "reason": "no_examples"}

    print("Basket weights:", {s: round(exp(b), 6) for s, b in log_baskets.items()})
    ranked = sorted(log_baskets, key=log_baskets.get, reverse=True)
    surface = ranked[0]
    sg = log_baskets[surface] - log_baskets[ranked[1]] if len(ranked) > 1 else None
    commands = sorted(command_scores[surface],
                      key=command_scores[surface].get, reverse=True)
    command = commands[0]
    best = command_scores[surface][command]
    cg = best - command_scores[surface][commands[1]] if len(commands) > 1 else None
    global_best = max(max(c.values()) for c in command_scores.values())

    if global_best < unknown:
        decision, reason = "UNKNOWN", "weak_match"
    elif sg is not None and sg < log(surface_ratio):
        decision, reason = "AMBIGUOUS", "surface_conflict"
    elif best < execute:
        decision, reason = "AMBIGUOUS", "weak_command"
    elif cg is not None and cg < command_margin:
        decision, reason = "AMBIGUOUS", "command_conflict"
    else:
        decision, reason = "EXECUTE", "confident_match"

    surface_known = decision != "UNKNOWN" and reason != "surface_conflict"
    return {
        "decision": decision,
        "reason": reason,
        "surface": surface if surface_known else None,
        "command": command if decision == "EXECUTE" else None,
        "command_score": round(best, 3),
        "surface_log_gap": round(sg, 3) if sg is not None else None,
        "command_gap": round(cg, 3) if cg is not None else None,
    }


# Language and query embedding are supplied externally; no models are called here.
language, query = "ru", [1.0, 0.0]

print("1. Aggregate support wins; the action is ambiguous")
print(route(make_index(), language, query))

print("2. Aggregate support wins; the action is distinguishable")
print(route(make_index(b_peaks=(0.89, 0.85, 0.85)), language, query))

print("3. A very strong individual match outweighs the group")
print(route(make_index(a_peak=0.99), language, query))
```

## 5. Calculation Results

Both baskets contain ten commands with one example each. The weight of a weak example with similarity `0.30` is `exp((0.30 − 1) / 0.05) ≈ 0.000000832`.

| Scenario | Strong matches in A | Strong matches in B | Weight A | Weight B | Result |
| --- | --- | --- | ---: | ---: | --- |
| 1 | 0.90 | 0.87, 0.87, 0.87 | 0.013534 | 0.022283 | B, but AMBIGUOUS: commands are tied |
| 2 | 0.90 | 0.89, 0.85, 0.85 | 0.013534 | 0.021038 | EXECUTE: B / B.1 |
| 3 | 0.99 | 0.87, 0.87, 0.87 | 0.081874 | 0.022283 | EXECUTE: A / A.1 |

In scenario 2, the best individual example belongs to A (`0.90 > 0.89`), but aggregate support selects B. The weight ratio B/A ≈ 1.554 exceeds the illustrative threshold of 1.5; the command gap within B is `0.89 − 0.85 = 0.04`, exceeding the threshold of 0.03.

In scenario 1, confidence in the basket does not imply confidence in the action: three commands are equally close, so none can be executed on that basis.

## 6. Limitations and Tuning

- `tau` and all thresholds in the example are illustrative. Tune them on held-out requests for the chosen embedding model, evaluating quality separately for each language.
- Normalization removes the direct advantage of size, but dilutes the weight of a broad basket containing many distant commands. This follows from the assumption of equally likely commands and must be evaluated on real surfaces.
- Repeating a command's entire example set does not change its mean. Selectively copying one example changes the distribution: duplicates and near-identical phrasings should be merged or have their combined weight limited.
- Three close commands may reflect a genuinely shared topic or insufficient action discrimination by the embedding model. Checking the command after selecting the basket is therefore essential.
- As the index grows, approximate search can be introduced, but it must be compared with the full calculation: a global top-M cutoff can remove support for some baskets. Normalization must account for the original group sizes.
- Compare against nearest neighbor and the original top-k consensus on the same test corpus: basket accuracy, command accuracy, false EXECUTE rate, rejection rate, and latency. Test paraphrases must not duplicate index examples.
