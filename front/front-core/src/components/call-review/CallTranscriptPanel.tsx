import React from "react";
import { Bot, MessageSquare, MicOff, RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge";
import { StereoCallPlayer } from "./StereoCallPlayer";

/** One recognised phrase of a call, as served by ms-calls' getTranscript. */
export type CallTranscriptLine = {
	time: number;
	source: "user" | "assistant";
	text: string;
};

export type CallTranscriptPanelProps = {
	sessionId: string;
	transcript: CallTranscriptLine[];
	loading?: boolean;
	userAudioUrl: string | null;
	assistantAudioUrl: string | null;
	onRefresh?: () => void;
	/** Header title, defaults to "Transcript". */
	title?: string;
	/** Section label above the message list, defaults to "Conversation". */
	conversationLabel?: string;
	emptyLabel?: string;
	className?: string;
};

export function callSessionLabel(sessionId: string): string {
	return (
		sessionId.slice(0, 8).toUpperCase() + "…" + sessionId.slice(-4).toUpperCase()
	);
}

/**
 * Transcript + stereo recording panel for a finished call. Purely
 * presentational: the caller loads the transcript (ms-calls getTranscript)
 * and the two WebM tracks and passes them in. Used by the admin (mf-calls
 * sidebar) and by the public landing demo-call page.
 */
export const CallTranscriptPanel: React.FC<CallTranscriptPanelProps> = ({
	sessionId,
	transcript,
	loading = false,
	userAudioUrl,
	assistantAudioUrl,
	onRefresh,
	title = "Transcript",
	conversationLabel = "Conversation",
	emptyLabel = "No transcript for this session.",
	className,
}) => {
	const hasAudio = userAudioUrl !== null || assistantAudioUrl !== null;

	return (
		<div className={`flex h-full min-h-0 flex-col ${className ?? ""}`}>
			{/* Header */}
			<div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0">
				<Bot size={16} className="text-muted-foreground shrink-0" />
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold leading-tight">{title}</p>
					<code className="text-[11px] text-muted-foreground font-mono">
						{callSessionLabel(sessionId)}
					</code>
				</div>
				{onRefresh && (
					<button
						onClick={onRefresh}
						title="Refresh"
						className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
					>
						<RefreshCw size={14} />
					</button>
				)}
			</div>

			{/* Recordings — single stereo player (You = left, AI = right) */}
			{hasAudio && (
				<div className="p-4 border-b border-border shrink-0">
					<StereoCallPlayer userSrc={userAudioUrl} aiSrc={assistantAudioUrl} />
				</div>
			)}

			{/* Transcript */}
			<div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
				<MessageSquare size={13} className="text-muted-foreground" />
				<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
					{conversationLabel}
				</span>
				{transcript.length > 0 && (
					<Badge variant="outline" className="text-xs ml-auto">
						{transcript.length} lines
					</Badge>
				)}
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
				{loading ? (
					<p className="text-sm text-muted-foreground px-1">Loading…</p>
				) : transcript.length === 0 ? (
					<div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
						<MicOff size={28} className="opacity-30" />
						<p className="text-sm">{emptyLabel}</p>
					</div>
				) : (
					transcript.map((line, i) => <TranscriptLine key={i} line={line} />)
				)}
			</div>
		</div>
	);
};

const TranscriptLine: React.FC<{ line: CallTranscriptLine }> = ({ line }) => {
	const isUser = line.source === "user";
	return (
		<div
			className={`flex gap-2 text-sm ${isUser ? "justify-end" : "justify-start"}`}
		>
			<div
				className={`max-w-[88%] rounded-2xl px-3 py-2 ${
					isUser
						? "bg-blue-900/40 text-blue-100 rounded-br-sm"
						: "bg-muted text-foreground rounded-bl-sm"
				}`}
			>
				<div className="text-[10px] opacity-50 mb-0.5 font-mono">
					{isUser ? "You" : "AI"} · {new Date(line.time * 1000).toLocaleTimeString()}
				</div>
				{line.text}
			</div>
		</div>
	);
};
