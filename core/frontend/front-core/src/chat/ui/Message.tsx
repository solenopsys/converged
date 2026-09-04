import type { ChatMessage } from "assistant-state";
import { useUnit } from "effector-preact";
import { downloadRequested } from "files-state";
import { translator } from "i18n";
import { useState } from "preact/hooks";
import { $activeLocale } from "../../i18n";
import {
	AlertCircle,
	Braces,
	Check,
	ChevronRight,
	FileDown,
	Loader2,
} from "../../icons";
import { CHAT_MESSAGES_NAMESPACE } from "../i18n";
import { formatFileSize } from "./labels";
import { renderMarkdown } from "./markdown";

const t = translator(CHAT_MESSAGES_NAMESPACE);

export function Message({ message }: { message: ChatMessage }) {
	if (message.fileData) return <FileBubble file={message.fileData} />;
	if (message.toolCallData) return <ToolCall data={message.toolCallData} />;

	return (
		<div class={`message-in panel-message ${message.type}`}>
			{message.type === "user" ? (
				message.content
			) : (
				<div class="message-markdown">{renderMarkdown(message.content)}</div>
			)}
		</div>
	);
}

export function StreamingMessage({ content }: { content: string }) {
	return (
		<div class="panel-message assistant">
			<div class="message-markdown">{renderMarkdown(content)}</div>
			<span class="stream-cursor" aria-hidden="true" />
		</div>
	);
}

function FileBubble({ file }: { file: NonNullable<ChatMessage["fileData"]> }) {
	const size = formatFileSize(file.fileSize);
	return (
		<button
			type="button"
			class="message-in panel-message user file-bubble"
			onClick={() =>
				downloadRequested({ fileId: file.fileId, fileName: file.fileName })
			}
			title={`Download ${file.fileName}`}
		>
			<FileDown aria-hidden="true" size={16} />
			<span class="file-bubble-name">{file.fileName}</span>
			{size ? <span class="file-bubble-size">{size}</span> : null}
		</button>
	);
}

function ToolCall({
	data,
}: {
	data: NonNullable<ChatMessage["toolCallData"]>;
}) {
	useUnit($activeLocale);
	const [expanded, setExpanded] = useState(false);
	const status = data.status ?? "completed";
	const details = data.details
		? typeof data.details === "string"
			? data.details
			: JSON.stringify(data.details, null, 2)
		: undefined;
	const steps = data.steps ?? [];
	const hasDetails = Boolean(data.summary || details || steps.length > 0);

	return (
		<div class={`message-in tool-call tool-call-${status}`}>
			<div class="tool-call-header">
				<span class="tool-call-icon" aria-hidden="true">
					<Braces size={16} />
				</span>
				<div class="tool-call-main">
					<span class="tool-call-kind">{t("toolCall.kind")}</span>
					<button
						type="button"
						class="tool-call-toggle"
						aria-expanded={expanded}
						disabled={!hasDetails}
						onClick={() => setExpanded((value) => !value)}
					>
						<span>{data.title}</span>
						{hasDetails ? (
							<ChevronRight
								aria-hidden="true"
								size={13}
								class={
									expanded ? "tool-call-chevron is-open" : "tool-call-chevron"
								}
							/>
						) : null}
					</button>
				</div>
				<ToolCallStatus status={status} />
			</div>
			{expanded ? (
				<div class="tool-call-details">
					{steps.length > 0 ? <ToolCallSteps steps={steps} /> : null}
					{data.summary ? (
						<p class="tool-call-summary">{data.summary}</p>
					) : null}
					{details ? <pre class="tool-call-json">{details}</pre> : null}
				</div>
			) : null}
		</div>
	);
}

const STEP_LABELS: Record<string, string> = {
	module: "toolCall.stepModule",
	select: "toolCall.stepFunction",
};

const NOTE_LABELS: Record<string, string> = {
	widened: "toolCall.noteWidened",
	approximate: "toolCall.noteApproximate",
};

/**
 * How the call was arrived at: one row per decision, with what else was on the
 * table. The alternatives are the point — when the pick is wrong, seeing that
 * the right function was never offered says the catalog is at fault, not the
 * model.
 */
function ToolCallSteps({
	steps,
}: {
	steps: NonNullable<NonNullable<ChatMessage["toolCallData"]>["steps"]>;
}) {
	return (
		<ol class="tool-call-steps">
			{steps.map((step) => {
				const others = step.options.filter(
					(option) => option.id !== step.chosen,
				);
				return (
					<li class="tool-call-step" key={`${step.step}:${step.chosen}`}>
						<span class="tool-call-step-kind">
							{STEP_LABELS[step.step] ? t(STEP_LABELS[step.step]) : step.step}
						</span>
						<div class="tool-call-step-body">
							<span class="tool-call-step-chosen">
								{step.chosenLabel ?? step.chosen}
							</span>
							{step.note ? (
								<span class="tool-call-step-note">
									{NOTE_LABELS[step.note]
										? t(NOTE_LABELS[step.note])
										: step.note}
								</span>
							) : null}
							{others.length > 0 ? (
								<span class="tool-call-step-options">
									{t("toolCall.alsoOffered", {
										options: others.map((option) => option.label).join(" · "),
									})}
								</span>
							) : (
								<span class="tool-call-step-options">
									{t("toolCall.noAlternatives")}
								</span>
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

function ToolCallStatus({
	status,
}: {
	status: "running" | "completed" | "failed";
}) {
	if (status === "running") {
		const label = t("toolCall.statusRunning");
		return (
			<span class="tool-call-status" title={label}>
				<Loader2 size={14} />
				<span>{label}</span>
			</span>
		);
	}
	if (status === "failed") {
		const label = t("toolCall.statusFailed");
		return (
			<span class="tool-call-status" title={label}>
				<AlertCircle size={14} />
				<span>{label}</span>
			</span>
		);
	}
	const label = t("toolCall.statusCompleted");
	return (
		<span class="tool-call-status" title={label}>
			<Check size={14} />
			<span>{label}</span>
		</span>
	);
}
