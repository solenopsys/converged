/**
 * Fetch a call recording from ms-calls and wrap it in an object URL the players
 * can consume. ms-calls builds the WebM/Opus container on demand, stores it in
 * the runtime cache, and nrpc returns only the cache reference.
 */
import { callsClient } from "g-calls";

export async function fetchCallAudioObjectUrl(
	callId: string,
	source: "user" | "assistant",
): Promise<string | null> {
	try {
		const audioRef = await callsClient.getCallAudio(callId, source);
		if (!audioRef?.cacheKey || audioRef.sizeBytes === 0) return null;
		const response = await fetch(
			`/cache/blob/${encodeURIComponent(audioRef.cacheKey)}`,
		);
		if (!response.ok) return null;
		const bytes = await response.arrayBuffer();
		if (bytes.byteLength === 0) return null;
		return URL.createObjectURL(new Blob([bytes], { type: "audio/webm" }));
	} catch {
		return null;
	}
}
