import { AccessTagsMigration } from "back-core";
import CreateEntries from "./createEntries";

// One tag relation for the store, added last so `billing_entries` already
// exists.
export default [CreateEntries, AccessTagsMigration];
