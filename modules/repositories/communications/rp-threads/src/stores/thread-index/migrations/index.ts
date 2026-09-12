import { AccessTagsMigration } from "back-core";
import createThreadIndex from "./createThreadIndex";

// The thread index is what carries a thread's access: the messages themselves
// live in the KV store keyed by thread id, so opening the index row is opening
// the conversation. One shared tag table from `back-core`, as everywhere else.
export default [createThreadIndex, AccessTagsMigration];
