import { AccessTagsMigration } from "back-core";
import AddOwner from "./addOwner";
import CreateChunks from "./createChunks";

// The tag relation over `chunk_metadata`. A block is content-addressed and
// deduplicated, so it genuinely has several owners at once — which is what a
// tag table says and an `owner` column cannot.
export default [CreateChunks, AddOwner, AccessTagsMigration];
