import { createCallsServiceClient } from "g-calls";
import { createThreadsServiceClient } from "g-threads";
import { createFrontNrpcClientConfig } from "signal-channel";

const callsClient = createCallsServiceClient(createFrontNrpcClientConfig());
const threadsClient = createThreadsServiceClient(createFrontNrpcClientConfig());

export type GateTranscriptItem = {
	time: number;
	source: "user" | "assistant";
	text: string;
};

// The call transcript lives in rp-threads, not in rp-calls: resonus writes each
// recognised phrase straight through threads.saveMessage, keyed by the session
// id, with user = "user" | "assistant" and a unix-seconds timestamp. rp-calls
// deliberately refuses to proxy that read (getTranscript throws — the direct
// rp-calls -> rp-threads hop is banned), so we read the thread here, the same
// way sf-chats and sf-threads already talk to rp-threads from the browser.
export async function readCallTranscript(
	sessionId: string,
): Promise<GateTranscriptItem[]> {
	if (!sessionId) return [];
	try {
		// registerCall defaults threadId to the call id, but the call record is
		// the authority on which thread holds its phrases.
		const call = await callsClient.getCall(sessionId).catch(() => undefined);
		const threadId = call?.threadId || sessionId;
		const messages = await threadsClient.readThread(threadId);
		return messages
			.map(
				(message): GateTranscriptItem => ({
					time: message.timestamp ?? 0,
					source: message.user === "user" ? "user" : "assistant",
					text: message.data ?? "",
				}),
			)
			.filter((item) => item.text.length > 0)
			.sort((left, right) => left.time - right.time);
	} catch (error) {
		console.warn(
			`[sf-calls] Failed to read the transcript for ${sessionId}`,
			error,
		);
		return [];
	}
}
