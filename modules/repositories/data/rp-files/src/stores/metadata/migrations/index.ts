import { AccessTagsMigration } from "back-core";
import AddCollections from "./addCollections";
import CreateFilesTables from "./createFiles";

// One tag relation for both `file_metadata` and `file_collections`: their ids
// are UUIDs, so they cannot collide and the `JOIN` separates them by itself.
// `file_chunks` stays out of it — a chunk is reached through its file, which is
// already tagged, and chunk hashes are shared between files by design.
export default [CreateFilesTables, AddCollections, AccessTagsMigration];
