import { getTableColumns } from "front-core";
import { classifierMappingFields, classifierNodeFields } from "./fields";

export const classifierNodeColumns = getTableColumns(classifierNodeFields);
export const classifierMappingColumns = getTableColumns(
	classifierMappingFields,
);
