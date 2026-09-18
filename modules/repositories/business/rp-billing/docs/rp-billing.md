# rp-billing

## Purpose

Money side of the platform: plans, charges, and billing state. Reads consumption aggregates from rp-usage; payment execution stays behind external gateways.

## Responsibility boundary

Owns billing workflows and billing records; does not own external payment gateway internals or usage measurement.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/business/rp-billing`
