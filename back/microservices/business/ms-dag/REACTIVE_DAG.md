# Reactive DAG (two-contour architecture)

This module uses a two-contour model. The goal is strict isolation of complexity
and full durability via KV (processing store). All state is written to KV before
any execution step.

## 1) Workflow router (strategic contour)
- Reacts to messages in a workflow context (KV).
- Does NOT execute node internals, loops, retries, or data transforms.
- Only routes based on message type and emits new messages or node calls.
- Durable: every message is stored in KV with status before processing.

## 2) Aspect processor (tactical contour)
- Processes exactly one node call in its own node context.
- Uses aspects to implement:
  - filtering (IF)
  - loops / parallel processing
  - input/output transforms
  - retries / error handling
- Logs every aspect step to KV with status (start/end/error).
- Does NOT perform routing; it only finishes the node call and emits a result
  message back to workflow context.

## Invariants (law)
- Write to KV BEFORE execution.
- Every message and every aspect step has durable state in KV.
- After crash/restart, processing resumes from KV state.

## KV layout (conceptual)
Workflow context:
- ctx:<workflowName>:<workflowContextId>            (meta)
- ctx:<workflowContextId>:msg:<messageId>           (workflow message)

Node context:
- ctx:<nodeName>:<nodeContextId>                    (meta)
- ctx:<nodeContextId>:msg:<messageId>               (node call message)
- ctx:<nodeContextId>:step:<stepId>                 (aspect step log)

Each message contains:
- id, type, payload, status, ts, updatedAt, meta

Each aspect step contains:
- id, aspect, phase(start/end/error), ts, data, error

## Routing model
Workflow router reacts to message types and dispatches node calls:
- message.type -> node call or subworkflow call
- node call creates a new node context and a node message
- node processor emits node.done / node.failed to workflow context
- router reacts to node.done and emits next message

## Subworkflow as node
- A workflow can call another workflow as if it were a node.
- The subworkflow gets a new contextId with meta:
  parentContextId, rootContextId.
- This makes the whole tree of executions recoverable from KV.

## Status progression
Message status (typical):
- queued -> processing -> done | failed

Step status (typical):
- start -> end | error

## Recovery
- Router reads workflow messages with status=queued.
- Aspect processor reads node messages with status=queued.
- All progress and failures are visible in KV.
