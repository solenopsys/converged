import { AccessTagsMigration } from "back-core";
import AddMappingPriority from "./addMappingPriority";
import CreateMappings from "./createMappings";
import CreateNodes from "./createNodes";

// One relation for both tables. Nodes and mappings are both keyed by a UUID
// minted here, so they are unique across the store and the `JOIN` back to the
// owning table is what tells one from the other. Listed last, after both tables
// exist.
export default [
	CreateNodes,
	CreateMappings,
	AddMappingPriority,
	AccessTagsMigration,
];
