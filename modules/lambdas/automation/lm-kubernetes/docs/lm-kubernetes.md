# lm-kubernetes

## Purpose

Stateless Kubernetes operator bridge: applies platform automation intents to cluster resources (deployments, jobs) via a dedicated client. No persistent state; secrets resolve via lm-secrets.

## Responsibility boundary

Owns cluster API translation and apply/status reads; does not own workflow orchestration, scheduling, or secret storage.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/automation/lm-kubernetes`
