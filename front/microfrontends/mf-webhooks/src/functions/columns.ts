import { getTableColumns } from "front-core";
import { endpointFields, logFields } from "./fields";

export const endpointColumns = getTableColumns(endpointFields);
export const logColumns = getTableColumns(logFields);
