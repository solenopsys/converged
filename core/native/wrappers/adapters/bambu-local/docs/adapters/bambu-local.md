# Bambu Lab local adapter

The Bambu Local adapter lets Converged work with a Bambu Lab printer over its
local network interface. It connects to the printer's MQTT-over-TLS endpoint,
authenticates with the LAN access code, and addresses the device by serial
number. Print control and telemetry stay on the local network; the Bambu Cloud
is not part of this path.

The adapter publishes commands for pause, resume, stop, raw JSON, and G-code.
It subscribes to device reports and forwards the latest state, printer
information, errors, and print telemetry through callbacks. Callers can also
request a JSON snapshot when they need the current state synchronously.

The default connection accepts the self-signed certificate commonly presented
by printers in LAN mode. The extended connection API accepts a CA certificate
when certificate verification is required.
