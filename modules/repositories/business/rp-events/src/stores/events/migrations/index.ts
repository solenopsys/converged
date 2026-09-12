import { AccessTagsMigration } from "back-core";
import AddEventLabel from "./addEventLabel";
import AddEventParentId from "./addEventParentId";
import CreateEvents from "./createEvents";

// One tag relation for the store, added last so `events` already exists.
export default [
	CreateEvents,
	AddEventParentId,
	AddEventLabel,
	AccessTagsMigration,
];
