# NRPC contract runtime

NRPC is Converged's typed remote-call layer. It turns a TypeScript service
contract into matching clients and service metadata, so a browser,
microservice, workflow, or native runtime can call the same capability without
maintaining separate string-based API definitions.

## Why it exists

The platform is composed of independently deployed modules. Calling one module
directly through an address would make its callers depend on where it runs and
which transport it uses. NRPC separates those concerns: a contract names the
service and its methods, while the runtime delivers a call to the process that
currently owns the requested target.

This keeps the agreement between callers and implementations in one place. A
method's parameters, return type, streaming behavior, and access level are
known to code generation and are available to every supported client.

## From contract to call

Contracts are TypeScript interfaces under `modules/types/<domain>`. Running
`bun run gen` in `core/tools/nrpc` parses those interfaces and creates a
`modules/generated/g-<service>` package. The package contains the contract
metadata, a server interface, and type-safe client factories for each runtime.

```text
TypeScript interface
        |
        v
NRPC generator -> g-<service> package
        |                    |
        |                    +-> browser client
        |                    +-> cluster client
        |                    +-> workflow RT client
        v
service implementation -> messaging backend
```

A service registers its implementation with `createMessagingBackend`. NRPC
uses the generated metadata to find the requested method, validates the call
shape at the client boundary, restores typed values, and invokes the matching
implementation method. A method returning `AsyncIterable` is delivered as a
stream; ordinary methods produce one response.

## Delivery paths

NRPC preserves the same contract across several execution environments:

- Browser clients use a shared WebSocket channel to send requests to Fujin.
- Service and native clients use the cluster transport through Fujin, addressed
  to a logical process target rather than a host address.
- Workflow clients use the RT entry point, which calls through the QuickJS/Zig
  host transport and remains synchronous for a single workflow evaluation.

Fujin routes a request to the target connection. The receiving process chooses
the NRPC service and method from the request metadata; Fujin does not need to
understand the platform's domain services. `createHttpBackend` is available
where an HTTP edge is required and can register the same service implementation
on the messaging runtime, keeping HTTP and internal calls aligned.

## Context and access

Calls carry correlation data, deadlines, and a trusted workspace or scope
context in their envelope. The receiving service runs with that context, which
allows storage and authorization code to use the same tenant boundary that was
established at the edge. Services must not derive workspace identity from a
business payload.

The `@Access` decorator declares a class or method as `public`, `user`, or
`internal`. NRPC resolves the most specific declared level and applies the
configured permission rules before invoking the implementation. This makes
access policy part of the service boundary rather than an inconsistent client
convention.

## Responsibility boundary

NRPC owns contract metadata, generated typed clients, value serialization,
call dispatch, and the transport adapters used by those calls. It does not own
business rules, service discovery, deployment placement, domain persistence, or
message-bus routing. Those responsibilities remain with the service,
deployment control plane, storage layer, and Fujin respectively.
