/**
 * Read a call's transcript from the ms-calls microservice.
 *
 * ms-calls is the single call-facing API: it owns the call entity and serves
 * the transcript (which it reads from ms-threads, where the audio-gate persists
 * each recognised phrase). The admin UI must NEVER call the gate for data — the
 * gate's only job is ingesting audio streams.
 */
import { callsClient } from "g-calls";
import type { GateTranscriptItem } from "./audio-gate-client";

export async function readCallTranscript(
	sessionId: string,
): Promise<GateTranscriptItem[]> {
	try {
		return (await callsClient.getTranscript(sessionId)) as GateTranscriptItem[];
	} catch {
		return [];
	}
}
