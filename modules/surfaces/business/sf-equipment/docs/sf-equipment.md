# sf-equipment

## Purpose

The shop floor as one working area: which machines exist, what state each is in,
what job it is running, what its telemetry says right now, what happened to it,
and what is booked on it next.

## Shape

The surface declares three `setOf` views — machines, journal, schedule — which
the workspace turns into the permanent buttons of this tab, and one `objectOf`
view for a machine. Opening a printer therefore opens a subtab *inside*
equipment rather than navigating away from it. With nothing pressed the surface
shows its own screen, `EquipmentDashboardView`.

## Responsibility boundary

Reads and writes `rp-equipment`. Reads `rp-orders` for the job a machine is
running and `rp-telemetry` for its live parameters — both directly from the
browser, which is where a two-call composition belongs; neither repository
knows about the other.

Machine state is written from here because, until a telemetry bridge reports it,
the operator standing next to the machine is its only source of truth.

## Direct module dependencies

- `g-equipment`
- `g-orders`
- `g-telemetry`

## Solution membership

- `production`

## Source

`modules/surfaces/business/sf-equipment`
