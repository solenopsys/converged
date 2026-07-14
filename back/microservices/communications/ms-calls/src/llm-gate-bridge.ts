/**
 * llm-gate-bridge — background sync from resonus → ms-calls
 *
 * After call sessions end in resonus this bridge:
 *   1. Lists all gate sessions
 *   2. Fetches the user WebM recording (presence = session complete)
 *   3. Saves it via CallsService.saveRecording()
 *   4. Fetches the transcript and saves via CallsService.saveDialogue()
 *
 * Runs on a configurable interval (default 60 s).
 *
 * Env:
 *   LLM_GATE_URL                  (required)
 *   LLM_GATE_SYNC_INTERVAL_MS     (default: 60000)
 */

import { CACHE_BLOB_TTL_SECONDS, required } from "back-core";
import type { CacheAdapter } from "back-core";
import type {
	CallsService,
	CallRecordingInput,
	CallDialogueInput,
} from "./types";

type GateTranscriptItem = {
	time: number;
	source: "user" | "assistant";
	text: string;
};

type GateSessionsResp = { ok: boolean; sessions: string[] };
type GateTranscriptResp = {
	ok: boolean;
	session: string;
	transcript: GateTranscriptItem[];
};

export class LlmGateBridge {
	private readonly gateUrl: string;
	private readonly intervalMs: number;
	/** Session IDs we've already persisted into ms-calls */
	private readonly synced = new Set<string>();
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private readonly service: CallsService,
		private readonly cache?: CacheAdapter,
	) {
		this.gateUrl = required("LLM_GATE_URL").replace(/\/$/, "");
		this.intervalMs = Number(process.env.LLM_GATE_SYNC_INTERVAL_MS ?? 60_000);
	}

	start(): void {
		this.timer = setInterval(() => void this.sync(), this.intervalMs);
		// First sync shortly after startup
		setTimeout(() => void this.sync(), 5_000);
		console.info(
			`[llm-gate-bridge] started — syncing every ${this.intervalMs}ms from ${this.gateUrl}`,
		);
	}

	stop(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	async sync(): Promise<void> {
		let sessions: string[];
		try {
			const r = await fetch(`${this.gateUrl}/sessions`, {
				signal: AbortSignal.timeout(8_000),
			});
			if (!r.ok) return;
			const d = (await r.json()) as GateSessionsResp;
			sessions = d.sessions ?? [];
		} catch (err) {
			// Gate may be down — normal when running without resonus
			console.debug(
				"[llm-gate-bridge] gate unreachable:",
				(err as Error).message,
			);
			return;
		}

		for (const sessionId of sessions) {
			if (this.synced.has(sessionId)) continue;
			try {
				const saved = await this.syncSession(sessionId);
				if (saved) this.synced.add(sessionId);
			} catch (err) {
				console.warn(
					`[llm-gate-bridge] failed to sync session ${sessionId}:`,
					err,
				);
			}
		}
	}

	/**
	 * Returns true if the session was synced, false if it should be retried later.
	 */
	private async syncSession(sessionId: string): Promise<boolean> {
		// A user recording means the session has at least partially ended
		const userWebm = await this.fetchRecording(sessionId, "user");
		if (!userWebm) return false; // still active or no audio — try again next interval

		const assistantWebm = await this.fetchRecording(sessionId, "assistant");
		const transcript = await this.fetchTranscript(sessionId);

		// Use the user recording as the stored binary.
		// The frontend reads directly from the gate; this copy is for long-term persistence.
		const input: CallRecordingInput = {
			phone: `gate:${sessionId.slice(0, 16)}`,
			startedAt: Date.now(),
			audioRef: await this.writeAudioRef(
				sessionId,
				"user-recording",
				new Uint8Array(userWebm),
			),
		};

		const { callId } = await this.service.saveRecording(input);

		if (transcript.length > 0) {
			const dialogueInput: CallDialogueInput = {
				callId,
				dialogue: transcript.map((t) => ({
					text: t.text,
					timestamp: t.time,
					who: t.source,
				})),
			};
			await this.service.saveDialogue(dialogueInput);
		}

		console.info(
			`[llm-gate-bridge] synced session ${sessionId} → call ${callId}` +
				(assistantWebm ? " (both tracks)" : " (user track only)"),
		);
		return true;
	}

	private async fetchRecording(
		sessionId: string,
		source: "user" | "assistant",
	): Promise<ArrayBuffer | null> {
		try {
			const r = await fetch(
				`${this.gateUrl}/record/${encodeURIComponent(sessionId)}/${source}`,
				{ signal: AbortSignal.timeout(30_000) },
			);
			if (r.status === 404) return null;
			if (!r.ok) return null;
			return await r.arrayBuffer();
		} catch {
			return null;
		}
	}

	private async fetchTranscript(
		sessionId: string,
	): Promise<GateTranscriptItem[]> {
		try {
			const r = await fetch(
				`${this.gateUrl}/transcript/${encodeURIComponent(sessionId)}`,
				{ signal: AbortSignal.timeout(8_000) },
			);
			if (!r.ok) return [];
			const d = (await r.json()) as GateTranscriptResp;
			return d.transcript ?? [];
		} catch {
			return [];
		}
	}

	private async writeAudioRef(
		sessionId: string,
		kind: string,
		data: Uint8Array,
	) {
		if (!this.cache) {
			throw new Error(
				"Valkey cache is required for llm-gate-bridge audio transfer",
			);
		}
		const cacheKey = this.cache.buildKey(
			"ms-calls",
			"bridge",
			sessionId,
			kind,
			crypto.randomUUID(),
		);
		await this.cache.setBytes(cacheKey, data, CACHE_BLOB_TTL_SECONDS);
		return { cacheKey, sizeBytes: data.byteLength };
	}
}
