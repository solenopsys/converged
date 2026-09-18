# rp-orders

## Purpose

Order lifecycle: creation, updates, listing, and tracking. Files attach by fileId (rp-files), discussion hangs off a threadId (rp-threads), completion can trigger review invites.

## Responsibility boundary

Owns order records and status transitions; does not own file storage, messaging, or review mechanics.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/business/rp-orders`
