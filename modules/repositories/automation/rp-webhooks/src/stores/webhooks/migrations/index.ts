import { AccessTagsMigration } from "back-core";
import addEndpointSlug from "./addEndpointSlug";
import createWebhooks from "./createWebhooks";

// The relation covers `webhook_endpoints`. `webhook_logs` keeps no tags of its
// own: a log is a delivery to one endpoint and is reached only through it, so
// it answers to that endpoint's tags — the same arrangement `rp-requests` uses
// for its processing trail. It also keeps integer log ids out of a relation
// whose ids have to be unique across everything it covers.
export default [createWebhooks, addEndpointSlug, AccessTagsMigration];
