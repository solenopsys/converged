import type { ChatMessage } from "assistant-state";
import { downloadRequested } from "files-state";
import { useState } from "preact/hooks";
import {
	AlertCircle,
	Braces,
	Check,
	ChevronRight,
	FileDown,
	Loader2,
} from "../../icons";
import { formatFileSize } from "./labels";
import { renderMarkdown } from "./markdown";

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
	const [expanded, setExpanded] = useState(false);
	const status = data.status ?? "completed";
	const details = data.details
		? typeof data.details === "string"
			? data.details
			: JSON.stringify(data.details, null, 2)
		: undefined;
	const hasDetails = Boolean(data.summary || details);

	return (
		<div class={`message-in tool-call tool-call-${status}`}>
			<div class="tool-call-header">
				<span class="tool-call-icon" aria-hidden="true">
					<Braces size={16} />
				</span>
				<div class="tool-call-main">
					<span class="tool-call-kind">Function</span>
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
					{data.summary ? (
						<p class="tool-call-summary">{data.summary}</p>
					) : null}
					{details ? <pre class="tool-call-json">{details}</pre> : null}
				</div>
			) : null}
		</div>
	);
}

function ToolCallStatus({
	status,
}: {
	status: "running" | "completed" | "failed";
}) {
	if (status === "running") {
		return (
			<span class="tool-call-status" title="Running">
				<Loader2 size={14} />
				<span>Running</span>
			</span>
		);
	}
	if (status === "failed") {
		return (
			<span class="tool-call-status" title="Failed">
				<AlertCircle size={14} />
				<span>Failed</span>
			</span>
		);
	}
	return (
		<span class="tool-call-status" title="Completed">
			<Check size={14} />
			<span>Done</span>
		</span>
	);
}
