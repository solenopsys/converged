
import { createFrontNrpcClientConfig } from "signal-channel";
import { createCallsServiceClient } from "g-calls";

const callsClient = createCallsServiceClient(createFrontNrpcClientConfig());
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
