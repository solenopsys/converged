# Converged command-line interface

The Converged CLI is an operator-facing command engine. It provides one
consistent command surface for platform diagnostics, automation, storage, and
domain operations while allowing each capability to remain in its own command
module.

## Modular command surface

The CLI core does not contain a fixed registry of business commands. At startup
it reads one or more directories passed through `--commands` and loads the
selected TypeScript module for each command section. A module exports a factory
that returns a processor; the processor declares its commands and routes each
command name to a handler.

```text
bun cli <section> <command> [param]
          |          |
          |          +-> command handler
          v
  command module -> processor -> generated NRPC client
```

This makes the CLI extensible without changing its runtime. A solution or
product can add a command directory, and a new `<section>.ts` module becomes a
new CLI section. The core loads only the requested section for execution, so an
optional or broken module cannot prevent unrelated commands from running.

`BaseCommandProcessor` supplies the common command map, help output, error
propagation, and consistent listing behavior. Modules focus on their own
arguments and domain actions; the runner owns connection setup, lifecycle
reporting, timing, exit status, and channel shutdown.

## One authorization model

All NRPC-enabled command modules use the same CLI session and authorization
path. The CLI first reads the user JWT from the local session file, then falls
back to `SERVICE_TOKEN` when no session is available. The user session takes
precedence because operator actions may require the caller's identity.

The token is sent during the shared Fujin WebSocket handshake and is also
provided to NRPC client configuration. If a stored session is rejected, the
runner removes it from the active connection and retries once with the service
token when one is configured. Authentication errors are reported uniformly,
with guidance to sign in again rather than leaving individual command modules
to handle token state themselves.

Authorization remains enforced by the receiving service. The CLI transports
the caller's credentials and workspace scope; it does not interpret permissions
or grant access locally. A command may opt out of the WebSocket channel only
when it deliberately talks to a non-NRPC endpoint, such as a direct diagnostic
operation.

## NRPC integration

Command modules create clients from generated `g-<service>` packages and pass
them the shared `createCliNrpcClientConfig` configuration. NRPC serializes the
typed method call into a WebSocket request, addressed to a logical Fujin target
and service. Fujin forwards it to the live runtime peer, and the service
applies its normal access policy before executing the method.

The same channel supports ordinary request-response methods and streaming
methods. Request identifiers, deadlines, response ordering, and connection
failure handling are centralised in the CLI channel, so every module gets the
same behavior without reimplementing protocol code.

## Responsibility boundary

The CLI owns command discovery, command execution lifecycle, local session
selection, and the common NRPC/WebSocket client channel. It does not own domain
business logic, permission decisions, service implementation, or Fujin routing.
Those responsibilities remain with command modules, backend services, and the
runtime infrastructure that receives the call.
