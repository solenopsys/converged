import { AccessTagsMigration } from "back-core";
import AddFilesCounters from "./addFilesCounters";
import CreateConversations from "./createConverstions";

// A conversation is one person's, so the tag relation is what separates them.
// Its id is the thread id, minted by the caller — which is safe here only
// because registering an id that already exists demands a tag of the caller's
// own, so a guessed id hijacks nothing.
export default [CreateConversations, AddFilesCounters, AccessTagsMigration];
