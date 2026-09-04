# rp-dag

## Purpose

Executes DAG-based automation pipelines and dependency-aware jobs.

## Responsibility boundary

Owns workflow graph scheduling/execution; does not own domain-specific business rules inside downstream services.

## Active workflow catalogue

Ptah supplies the active Solution's `WORKFLOWS` descriptors through the
service environment. The service exposes this metadata alongside execution and
task state; it does not select Solutions or load workflow source code.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/automation/rp-dag`
