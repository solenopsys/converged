# Module catalogue

This index is generated from the Converged module registry. Every entry links to documentation owned by that module; dependencies are taken from its workspace package manifest, and solution membership comes from `modules/solutions`.

## Access and security

### [mf-auth](/en/docs/modules/mf-auth)

Owns Auth UI: sign-in/sign-up/reset flows, session/security screens, and authentication guard/redirect UX behavior.

- Direct dependencies: none
- Solutions: `security`

### [mf-secrets](/en/docs/modules/mf-secrets)

Provides the administration interface for creating, viewing, updating, and deleting named secret records.

- Direct dependencies: none
- Solutions: none

### [ms-access](/en/docs/modules/ms-access)

Manages access-control rules and permission checks.

- Direct dependencies: none
- Solutions: `security`

### [ms-auth](/en/docs/modules/ms-auth)

Handles authentication workflows and credential/session validation.

- Direct dependencies: none
- Solutions: `security`

### [ms-environment](/en/docs/modules/ms-environment)

Stores and retrieves environment configuration associated with platform users.

- Direct dependencies: none
- Solutions: none

### [ms-identity](/en/docs/modules/ms-identity)

Maintains identity profiles and identity-linked core attributes.

- Direct dependencies: none
- Solutions: `security`

### [ms-oauth](/en/docs/modules/ms-oauth)

Implements OAuth-specific authorization flows and provider handshakes.

- Direct dependencies: none
- Solutions: `security`

### [ms-secrets](/en/docs/modules/ms-secrets)

Provides the service contract for storing, retrieving, and deleting named secret values.

- Direct dependencies: none
- Solutions: none

## AI and agents

### [mf-agents](/en/docs/modules/mf-agents)

Owns AI Agents UI: agent catalog/list pages, agent config forms, run/trigger controls, and execution status panels.

- Direct dependencies: none
- Solutions: `ai`

### [mf-assistants](/en/docs/modules/mf-assistants)

Owns Assistants UI: assistant chat/workspace views, assistant configuration panels, and assistant session interaction components.

- Direct dependencies: `mf-requests`
- Solutions: `ai`

### [mf-contexts](/en/docs/modules/mf-contexts)

Provides the AI workspace for listing, editing, and saving named contexts in multiple languages.

- Direct dependencies: none
- Solutions: `ai`

### [mf-functions](/en/docs/modules/mf-functions)

Provides the AI workspace for browsing, searching, registering, and executing function definitions.

- Direct dependencies: none
- Solutions: none

### [ms-agent](/en/docs/modules/ms-agent)

Runs autonomous AI-agent workflows and orchestrates multi-step LLM tasks.

- Direct dependencies: none
- Solutions: `ai`

### [ms-assistant](/en/docs/modules/ms-assistant)

Provides assistant-style AI interactions for end users and internal tools.

- Direct dependencies: none
- Solutions: `ai`

### [ms-contexts](/en/docs/modules/ms-contexts)

Provides storage and retrieval of named AI contexts, including their language variants.

- Direct dependencies: none
- Solutions: `ai`

### [ms-functions](/en/docs/modules/ms-functions)

Provides the registry and search surface for callable AI function definitions and their embeddings.

- Direct dependencies: none
- Solutions: none

## Analytics and telemetry

### [mf-dasboards](/en/docs/modules/mf-dasboards)

Owns Analytics Dashboard UI: overview dashboards, KPI cards, trend charts, and dashboard-level filters/date ranges.

- Direct dependencies: none
- Solutions: none

### [mf-logs](/en/docs/modules/mf-logs)

Owns Logs UI: log stream/table views, log search/filter controls, and log detail drill-down panels for operators.

- Direct dependencies: none
- Solutions: `analitycs`

### [mf-telemetry](/en/docs/modules/mf-telemetry)

Owns Telemetry UI: technical signal views, metrics graphs, event timelines, and service-health visual components.

- Direct dependencies: none
- Solutions: `analitycs`

### [mf-usage](/en/docs/modules/mf-usage)

Owns Usage UI: feature-consumption charts, usage counters, quota/limit displays, and usage period comparison screens.

- Direct dependencies: none
- Solutions: `analitycs`

### [ms-counters](/en/docs/modules/ms-counters)

Provides the service contract for collecting and querying analytical counters.

- Direct dependencies: none
- Solutions: `analitycs`

### [ms-dashboard](/en/docs/modules/ms-dashboard)

Provides dashboard data and analytical views for platform metrics.

- Direct dependencies: none
- Solutions: none

### [ms-logs](/en/docs/modules/ms-logs)

Collects and stores operational logs for platform services.

- Direct dependencies: none
- Solutions: `analitycs`

### [ms-telemetry](/en/docs/modules/ms-telemetry)

Captures telemetry events and technical health signals from services.

- Direct dependencies: none
- Solutions: `analitycs`

### [ms-usage](/en/docs/modules/ms-usage)

Tracks usage counters and consumption metrics for product features.

- Direct dependencies: none
- Solutions: `analitycs`

## Automation and orchestration

### [mf-dag](/en/docs/modules/mf-dag)

Owns DAG Automation UI: workflow graph editor/viewer, node/link configuration dialogs, and run-status monitoring screens.

- Direct dependencies: none
- Solutions: none

### [mf-sheduller](/en/docs/modules/mf-sheduller)

Owns Scheduler UI: recurring job configuration pages, schedule calendars/tables, and job run history/next-run indicators.

- Direct dependencies: none
- Solutions: none

### [mf-webhooks](/en/docs/modules/mf-webhooks)

Owns Webhooks UI: webhook endpoint list/forms, event subscription settings, delivery history, and retry controls.

- Direct dependencies: none
- Solutions: none

### [ms-dag](/en/docs/modules/ms-dag)

Executes DAG-based automation pipelines and dependency-aware jobs.

- Direct dependencies: none
- Solutions: none

### [ms-kubernetes](/en/docs/modules/ms-kubernetes)

Integrates platform automation with Kubernetes resources through a dedicated client and service contract.

- Direct dependencies: none
- Solutions: none

### [ms-sheduller](/en/docs/modules/ms-sheduller)

Stores and serves automation schedule data and execution history.

- Direct dependencies: none
- Solutions: none

### [ms-webhooks](/en/docs/modules/ms-webhooks)

Receives and dispatches webhook events for external integrations.

- Direct dependencies: none
- Solutions: none

## Business domain

### [mf-orders](/en/docs/modules/mf-orders)

Provides the sales interface for order and request lists, order details, status filtering, and operational dashboards.

- Direct dependencies: none
- Solutions: none

### [mf-requests](/en/docs/modules/mf-requests)

Owns Requests UI: request inbox/list screens, request detail/timeline views, and request status/action forms.

- Direct dependencies: none
- Solutions: `requests`

### [ms-billing](/en/docs/modules/ms-billing)

Handles billing domain operations such as plans, charges, and billing state.

- Direct dependencies: none
- Solutions: none

### [ms-equipment](/en/docs/modules/ms-equipment)

Manages equipment entities, metadata, and related lifecycle operations.

- Direct dependencies: none
- Solutions: none

### [ms-events](/en/docs/modules/ms-events)

Provides creation, storage, and retrieval of business events.

- Direct dependencies: none
- Solutions: none

### [ms-finance](/en/docs/modules/ms-finance)

Provides finance operations for transactions, period summaries, cashflow, receivables, and payables.

- Direct dependencies: none
- Solutions: none

### [ms-orders](/en/docs/modules/ms-orders)

Provides the service contract for creating, updating, listing, and tracking business orders.

- Direct dependencies: none
- Solutions: none

### [ms-requests](/en/docs/modules/ms-requests)

Processes service/business requests submitted by users or organizations.

- Direct dependencies: none
- Solutions: `requests`

### [ms-reviews](/en/docs/modules/ms-reviews)

Stores and manages user or partner reviews and moderation-related metadata.

- Direct dependencies: none
- Solutions: none

### [ms-sales](/en/docs/modules/ms-sales)

Handles sales-domain entities, sales flows, and related metrics preparation.

- Direct dependencies: none
- Solutions: none

### [ms-staff](/en/docs/modules/ms-staff)

Manages staff records, roles, and staff-centric domain operations.

- Direct dependencies: none
- Solutions: none

## Communications

### [mf-calls](/en/docs/modules/mf-calls)

Owns Calls UI: call session screens, call controls, call participant/status panels, and call history presentation widgets.

- Direct dependencies: none
- Solutions: `ai`

### [mf-chats](/en/docs/modules/mf-chats)

Owns Charts UI: reusable communication/report chart widgets, chart configuration controls, and chart drill-down interactions.

- Direct dependencies: none
- Solutions: `ai`

### [mf-community](/en/docs/modules/mf-community)

Owns Community UI: community feed/list pages, community post/detail views, and moderation/community action controls.

- Direct dependencies: none
- Solutions: none

### [mf-threads](/en/docs/modules/mf-threads)

Owns Threads UI: threaded conversation lists, thread detail panels, reply composers, and thread state indicators.

- Direct dependencies: none
- Solutions: `ai`

### [ms-calls](/en/docs/modules/ms-calls)

Provides call-related communication workflows and call session handling.

- Direct dependencies: none
- Solutions: `ai`

### [ms-chats](/en/docs/modules/ms-chats)

Generates and serves chart-oriented communication or reporting artifacts.

- Direct dependencies: none
- Solutions: `ai`

### [ms-community](/en/docs/modules/ms-community)

Supports community-level interactions and social communication features.

- Direct dependencies: none
- Solutions: none

### [ms-notify](/en/docs/modules/ms-notify)

Coordinates notification workflows across channels.

- Direct dependencies: none
- Solutions: none

### [ms-resonus](/en/docs/modules/ms-resonus)

Provides communication configuration for managed phone numbers and LLM gate settings.

- Direct dependencies: none
- Solutions: none

### [ms-threads](/en/docs/modules/ms-threads)

Manages threaded conversations and related message context.

- Direct dependencies: none
- Solutions: `ai`

## Content and documents

### [mf-classifier](/en/docs/modules/mf-classifier)

Provides the classifier interface for navigating entities, mappings, and tree structures.

- Direct dependencies: none
- Solutions: none

### [mf-docs](/en/docs/modules/mf-docs)

Owns Docs UI: document browsing, document detail views, editing/preview interfaces, and documentation navigation components.

- Direct dependencies: none
- Solutions: `content`

### [mf-galery](/en/docs/modules/mf-galery)

Owns Gallery UI: media gallery grids, media preview/detail views, gallery organization controls, and gallery filtering/search.

- Direct dependencies: none
- Solutions: `content`

### [mf-landing](/en/docs/modules/mf-landing)

Owns Landing UI: landing pages, hero/section composition, and public-facing content presentation blocks.

- Direct dependencies: none
- Solutions: `content`

### [mf-markdown](/en/docs/modules/mf-markdown)

Owns Markdown UI: markdown editor surfaces, live preview panels, markdown content formatting controls, and publish-ready views.

- Direct dependencies: none
- Solutions: `content`

### [mf-scripts](/en/docs/modules/mf-scripts)

Provides the content interface for listing, reading, editing, saving, and deleting script files.

- Direct dependencies: none
- Solutions: none

### [mf-static](/en/docs/modules/mf-static)

Provides the operations interface for inspecting and clearing static SSR cache entries.

- Direct dependencies: none
- Solutions: none

### [mf-struct](/en/docs/modules/mf-struct)

Owns Structured Content UI: schema-driven content forms, structured block editors, and structured content preview/validation views.

- Direct dependencies: none
- Solutions: `content`

### [ms-classifier](/en/docs/modules/ms-classifier)

Classifies incoming content/items into categories, labels, or intents.

- Direct dependencies: none
- Solutions: none

### [ms-galery](/en/docs/modules/ms-galery)

Manages gallery-style media collections and related metadata.

- Direct dependencies: none
- Solutions: `content`

### [ms-markdown](/en/docs/modules/ms-markdown)

Processes markdown content, rendering/transformation workflows, and related APIs.

- Direct dependencies: none
- Solutions: `content`

### [ms-scripts](/en/docs/modules/ms-scripts)

Provides storage operations for script files, including reading, saving, hashing, and deletion.

- Direct dependencies: none
- Solutions: none

### [ms-static](/en/docs/modules/ms-static)

Provides the service contract for static content and SSR cache metadata.

- Direct dependencies: none
- Solutions: none

### [ms-struct](/en/docs/modules/ms-struct)

Builds and serves structured content representations used by other services.

- Direct dependencies: none
- Solutions: `content`

## Files and storage

### [mf-dumps](/en/docs/modules/mf-dumps)

Owns Data Dumps UI: export/dump creation forms, dump history tables, download actions, and dump status/progress indicators.

- Direct dependencies: none
- Solutions: none

### [ms-dumps](/en/docs/modules/ms-dumps)

Creates and manages data dumps/export snapshots.

- Direct dependencies: none
- Solutions: none

### [ms-files](/en/docs/modules/ms-files)

Provides file metadata APIs and file-management workflows.

- Direct dependencies: none
- Solutions: `requests`

### [ms-store](/en/docs/modules/ms-store)

Implements generic storage-domain operations for service data.

- Direct dependencies: none
- Solutions: `requests`

## Message delivery providers

### [ms-push](/en/docs/modules/ms-push)

Provider adapter for push-notification delivery.

- Direct dependencies: none
- Solutions: none

### [ms-ses](/en/docs/modules/ms-ses)

Provider adapter for AWS SES email delivery.

- Direct dependencies: none
- Solutions: `security`

### [ms-sms](/en/docs/modules/ms-sms)

Provider adapter for SMS delivery channels.

- Direct dependencies: none
- Solutions: none

### [ms-smtp](/en/docs/modules/ms-smtp)

Provider adapter for SMTP-based email delivery.

- Direct dependencies: none
- Solutions: none

## Model conversion

### [ms-modelconvertor](/en/docs/modules/ms-modelconvertor)

Converts models/data formats between internal and external representations.

- Direct dependencies: none
- Solutions: none

## Workflows

### [wf-dialogue-summary](/en/docs/modules/wf-dialogue-summary)

Summarizes unprocessed chat and call dialogues with an LLM, then stores titles, descriptions, and noise classification.

- Direct dependencies: none
- Solutions: none

### [wf-files-process](/en/docs/modules/wf-files-process)

Processes uploaded files in batches: it expands archives, identifies model files, and creates a request when applicable.

- Direct dependencies: none
- Solutions: `requests`

### [wf-file-analyze](/en/docs/modules/wf-file-analyze)

Analyzes one stored non-archive file, producing model previews and CNC or 3D-print estimates when supported.

- Direct dependencies: none
- Solutions: none

### [wf-file-unpack](/en/docs/modules/wf-file-unpack)

Expands one uploaded archive into a collection of stored files for subsequent analysis.

- Direct dependencies: none
- Solutions: `requests`

### [wf-sales-import](/en/docs/modules/wf-sales-import)

wf-sales-import is a workflow in the platform domain. Its detailed purpose is maintained with the module source.

- Direct dependencies: none
- Solutions: none

### [wf-sales-review-outreach](/en/docs/modules/wf-sales-review-outreach)

wf-sales-review-outreach is a workflow in the platform domain. Its detailed purpose is maintained with the module source.

- Direct dependencies: none
- Solutions: none

## Solution dependencies

- `ai`: `security`
- `analitycs`: `security`
- `content`: `security`
- `requests`: no solution dependencies
- `security`: no solution dependencies
