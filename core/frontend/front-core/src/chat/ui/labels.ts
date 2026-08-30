import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../i18n";

const t = translator(CHAT_MESSAGES_NAMESPACE);

type BriefResolver = (id: string) => string | undefined;

// Set by the shell; the embed widget has no catalog and leaves it empty.
let resolveBrief: BriefResolver = () => undefined;

export function setActionBriefResolver(resolver: BriefResolver): void {
	resolveBrief = resolver;
}

const TOOL_KEYS: Record<string, string> = {
	startFilesProcess: "tool.analyzeFiles",
	getUploadedChatFiles: "tool.checkUploads",
	listFunctions: "tool.pickFunction",
	describeFunction: "tool.clarifyFunction",
};

const ACTION_KEYS: Array<[RegExp, string]> = [
	[/analyz|extract|detect|parse/, "action.analyzing"],
	[/file|upload|download|attach|storage/, "action.files"],
	[/search|find|query|lookup/, "action.searching"],
	[/create|save|write|add|register/, "action.saving"],
	[/get|read|fetch|load|list|show/, "action.loading"],
];

// A catalog function's own brief beats any heuristic and is known from the
// delivery index before its module loads (docs/AI.md §4.2).
const known = (name: string): string | undefined => {
	const key = TOOL_KEYS[name];
	return key ? t(key) : resolveBrief(name);
};

export const toolCallLabel = (toolName?: string): string =>
	(toolName && known(toolName)) || t("step.acting");

export function toolActionLabel(toolName?: string): string {
	if (!toolName) return t("step.thinking");

	const label = known(toolName);
	if (label) return `${label}…`;

	const name = toolName.toLowerCase();
	const guess = ACTION_KEYS.find(([pattern]) => pattern.test(name))?.[1];
	return guess ? t(guess) : t("step.thinking");
}

export function formatFileSize(bytes?: number): string {
	if (!bytes) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
