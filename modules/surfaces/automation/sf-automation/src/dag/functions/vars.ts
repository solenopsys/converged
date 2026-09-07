import { getAllFormFields } from "front-core";

export const varsFormFields = getAllFormFields([
	{
		id: "value",
		title: "Value",
		type: "textarea",
		required: true,
		rows: 8,
		placeholder: "Enter value (JSON supported)",
		helpText: "Valid JSON will be saved as JSON, otherwise as plain text.",
	},
]);

/** A variable holds whatever the workflow put there, so text that parses as
 *  JSON is stored as JSON and anything else stays a string. */
export const parseVarValue = (raw: any) => {
	if (typeof raw !== "string") return raw;
	const trimmed = raw.trim();
	if (!trimmed.length) return "";
	try {
		return JSON.parse(trimmed);
	} catch {
		return raw;
	}
};
