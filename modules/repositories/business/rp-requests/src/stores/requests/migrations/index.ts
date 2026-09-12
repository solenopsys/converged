import { AccessTagsMigration } from "back-core";
import AddCollections from "./addCollections";
import AddProcessing from "./addProcessing";
import AddRequestModel from "./addRequestModel";
import CreateRequests from "./createRequests";

// The tag relation covers `requests`. `request_processing` is the audit trail
// of one request and is reached only through it, so it answers to the request's
// tags rather than carrying its own.
export default [
	CreateRequests,
	AddProcessing,
	AddRequestModel,
	AddCollections,
	AccessTagsMigration,
];
