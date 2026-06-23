/**
 * Fetch a call recording from ms-calls and wrap it in an object URL the players
 * can consume. ms-calls builds the WebM/Opus container on demand, stores it in
 * the runtime cache, and nrpc returns only the cache reference.
 */
import { callsClient } from "g-calls";

// Resolve the current tenant the same way the nrpc client does. The runtime
// cache is per-tenant (storage scope), so a plain /cache/blob fetch must carry
// the workspace/scope header — otherwise the server can't resolve which Valkey
// holds the blob and fails loudly ("Storage scope is required"). nrpc calls get
// this for free; a raw fetch does not, so we mirror the resolution here.
function resolveWorkspaceScope(): string | undefined {
	const g = globalThis as Record<string, unknown> & {
		__NRPC_SCOPE_RESOLVER__?: () => string | undefined;
		__NRPC_SCOPE__?: string;
		__NRPC_WORKSPACE_RESOLVER__?: () => string | undefined;
		__NRPC_WORKSPACE__?: string;
	};
	const value =
		g.__NRPC_SCOPE_RESOLVER__?.() ??
		g.__NRPC_SCOPE__ ??
		g.__NRPC_WORKSPACE_RESOLVER__?.() ??
		g.__NRPC_WORKSPACE__;
	const normalized = value?.trim();
	return normalized || undefined;
}

export async function fetchCallAudioObjectUrl(
	callId: string,
	source: "user" | "assistant",
): Promise<string | null> {
	try {
		const audioRef = await callsClient.getCallAudio(callId, source);
		if (!audioRef?.cacheKey || audioRef.sizeBytes === 0) return null;
		const scope = resolveWorkspaceScope();
		const response = await fetch(
			`/cache/blob/${encodeURIComponent(audioRef.cacheKey)}`,
			scope ? { headers: { workspace: scope } } : undefined,
		);
		if (!response.ok) return null;
		const bytes = await response.arrayBuffer();
		if (bytes.byteLength === 0) return null;
		return URL.createObjectURL(new Blob([bytes], { type: "audio/webm" }));
	} catch {
		return null;
	}
}
