# lm-modelconvertor

## Purpose

The shared model-format bridge: converts production models between
internal and external representations (e.g. to GLB previews) so no
workflow links a native converter library directly.

## Mental model

Workflow stages model bytes → convertor transforms format → returns
preview/converted bytes as cache refs for `rp-files.persist`. Pure
transformation: no storage, no estimates, no business decisions.

## Ecosystem value

One conversion point for production models:

- A staged file in, converted outputs as cache refs out — same shape for any caller.
- New formats and converter versions land once and upgrade every analysis path.
- Keeps heavy native deps out of workflows and repositories.

## Non-goals

- Not file storage or intake orchestration.
- Not preview rendering or slicing estimates.
## Responsibility boundary

Owns conversion/transformation routines; does not own upstream model
training, downstream serving, or persistence.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/convertors/lm-modelconvertor`
