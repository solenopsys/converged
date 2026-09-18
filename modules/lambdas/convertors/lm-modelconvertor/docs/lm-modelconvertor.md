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

One conversion point for production:

- `wf-file-analyze` / `wf-files-analyze` / `wf-request-analyze` all get GLB
  previews from here — same output shape everywhere.
- New formats and converter versions land once and upgrade every analysis
  path.
- Keeps heavy native deps out of workflows and repositories.

## Non-goals

- No model training or serving.
- No slicing/CAM estimates — that is opencamlib/curaengine processors.
- No file persistence — that is `rp-files`.

## Responsibility boundary

Owns conversion/transformation routines; does not own upstream model
training, downstream serving, or persistence.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/convertors/lm-modelconvertor`
