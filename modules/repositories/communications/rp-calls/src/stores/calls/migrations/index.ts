import { AccessTagsMigration } from "back-core";
import addAudioFragments from "./addAudioFragments";
import addCallSummary from "./addCallSummary";
import createCalls from "./createCalls";

// The tag relation covers `calls`. Fragments are not tagged separately: a
// fragment is reached only through its call, which is already tagged, and its
// id never leaves this service on its own.
export default [
	createCalls,
	addAudioFragments,
	addCallSummary,
	AccessTagsMigration,
];
