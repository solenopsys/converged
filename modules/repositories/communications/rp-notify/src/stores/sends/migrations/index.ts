import { AccessTagsMigration } from "back-core";
import createSends from "./createSends";

// One tag relation for the store, added last so `notify_sends` already exists.
// The template and channel stores are file- and json-backed configuration, and
// per `access-control.md` those keep no relation of their own.
export default [createSends, AccessTagsMigration];
