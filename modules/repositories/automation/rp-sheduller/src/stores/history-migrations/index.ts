import { AccessTagsMigration } from "back-core";
import CreateHistory from "./createHistory";

// One tag relation for the history store, added last so `history` already
// exists. The crons themselves live in a json store, which per
// `access-control.md` keeps no relation of its own.
export default [CreateHistory, AccessTagsMigration];
