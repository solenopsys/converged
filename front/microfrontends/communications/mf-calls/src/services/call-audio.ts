/**
 * Fetch a call recording from ms-calls and wrap it in an object URL the players
 * can consume. ms-calls builds the WebM/Opus container on demand from the
 * stored 20 ms Opus frames; nrpc returns it as a real Uint8Array.
 */
import { callsClient } from "g-calls";

export async function fetchCallAudioObjectUrl(
  callId: string,
  source: "user" | "assistant",
): Promise<string | null> {
  try {
    const bytes = await callsClient.getCallAudio(callId, source);
    if (!bytes || bytes.byteLength === 0) return null;
    return URL.createObjectURL(new Blob([bytes], { type: "audio/webm" }));
  } catch {
    return null;
  }
}
