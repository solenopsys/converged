import { AccessTagsMigration } from "back-core";
import addVisibility from "./addVisibility";
import createSections from "./createSections";
import createTopics from "./createTopics";

// `AccessTagsMigration` is the shared one from `back-core`: one tag table per
// store, serving both sections and topics. It is listed last because the tables
// it is joined against have to exist first.
export default [
	createSections,
	createTopics,
	addVisibility,
	AccessTagsMigration,
];
