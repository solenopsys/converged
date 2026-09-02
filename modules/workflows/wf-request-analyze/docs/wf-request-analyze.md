# wf-request-analyze

## Purpose

Analyses one request: it stages every production model the request carries, builds a GLB preview and a CNC or 3D-print estimate for each of them in the ptah processor containers, and writes the previews and the analysis back onto the request.

## Responsibility boundary

The module boundary is defined by its public contracts and implementation directory.

## Direct module dependencies

- None

## Solution membership

- `requests`

## Source

`modules/workflows/wf-request-analyze`
