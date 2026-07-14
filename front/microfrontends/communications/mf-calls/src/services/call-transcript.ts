/**
 * Read a call's transcript from the ms-calls microservice.
 *
 * ms-calls is the single call-facing API: it owns the call entity and serves
 * the transcript (which it reads from ms-threads). The admin UI never calls the
 * native gateway for persisted data.
 */
import { callsClient } from "g-calls";
export type GateTranscriptItem = {
	time: number;
	source: "user" | "assistant";
	text: string;
};

export async function readCallTranscript(
	sessionId: string,
): Promise<GateTranscriptItem[]> {
	try {
		return (await callsClient.getTranscript(sessionId)) as GateTranscriptItem[];
	} catch {
		return [];
	}
}
