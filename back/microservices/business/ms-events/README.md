# ms-events

Stores low-volume business events for the operator state stream.

The service keeps an append-only SQL journal with `createdAt`, `type`, `service`, and `entityId`. It does not store logs, telemetry, message bodies, filters, or payload streams.
