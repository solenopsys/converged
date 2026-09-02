# Resonus media and AI gateway

Resonus connects real-time conversations to the Converged platform. It handles
browser audio, phone calls, transcription and AI sessions while keeping the
resulting business actions inside the same permissions and workflow model used
by the rest of the system.

## One session boundary

Media transport and AI interaction share call state, timing and context.
Keeping them in one native process avoids passing a live conversation through
several independent gateways before it can reach a model or a human operator.

```text
browser or phone
       |
       v
    Resonus ---- AI session
       |
       +-------- human transfer
       |
       +-------- platform services and workflows
```

A deployment policy chooses how an incoming call is handled: by an AI session,
by a human destination, by a transfer path or by rejection. Transport and media
execution stay native, while the policy remains a small replaceable decision
layer.

## Platform integration

Resonus uses platform services for call context and business records. Audio
fragments can pass through the runtime cache before the owning service stores
them. Calls can trigger workflows or service operations without giving the
gateway ownership of those domains.

Transcription turns voice into the same kind of structured input available to
other interfaces. This lets an operator or customer interact naturally while
the resulting action still follows normal service contracts and audit paths.

## Trusted tenant context

For traffic arriving through Fujin, Resonus accepts the tenant scope from the
trusted message envelope. It does not infer a scope from a phone number, user
label or model payload. The scope is retained for the session and forwarded to
the platform services used by that session.

Ingress paths that cannot establish a trusted scope must be isolated until the
deployment binds them to one. This prevents a convenient media identifier from
silently becoming an authorization decision.

## Provider boundary

AI providers sit behind a common session and policy boundary. Provider choice,
model selection, voice and transfer behavior are deployment decisions rather
than assumptions embedded throughout business modules. The gateway can evolve
its provider adapters without changing how the rest of Converged addresses an
AI-assisted call.

## Place in the system

Resonus owns real-time media and AI-session execution. It does not own customer
records, call history, workflow definitions, tenant selection or general
message routing. Those responsibilities remain with domain services,
Centimanus, the trusted edge and Fujin.
