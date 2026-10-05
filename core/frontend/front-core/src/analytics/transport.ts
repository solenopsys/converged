const INGEST_URI = "/ingest/analytics";
const FLUSH_INTERVAL_MS = 2_000;
const MAX_BATCH_BYTES = 16 * 1024;
const MAX_PENDING_BYTES = 32 * 1024;

// Finite NDJSON requests work in Safari, Firefox, and embedded browsers too.
// Keep the in-flight batch plus the exit beacon below the keepalive byte limit.
export function createAnalyticsTransport() {
	const encoder = new TextEncoder();
	const pending: Array<{ line: string; bytes: number }> = [];
	let pendingBytes = 0;
	let timer: number | undefined;
	let inFlight = false;
	let paused = false;

	function clearTimer() {
		if (timer !== undefined) window.clearTimeout(timer);
		timer = undefined;
	}

	function schedule() {
		if (paused || timer !== undefined || pending.length === 0) return;
		timer = window.setTimeout(() => {
			timer = undefined;
			flush();
		}, FLUSH_INTERVAL_MS);
	}

	function flush(unloading = false) {
		clearTimer();
		if (!pending.length || (!unloading && (paused || inFlight))) return;
		if (!unloading && navigator.onLine === false) return;
		const limit = unloading ? MAX_PENDING_BYTES : MAX_BATCH_BYTES;
		let body = "";
		let bytes = 0;
		while (pending.length && bytes + pending[0].bytes <= limit) {
			const item = pending.shift()!;
			body += item.line;
			bytes += item.bytes;
			pendingBytes -= item.bytes;
		}
		if (!body) return;
		if (unloading) {
			try {
				if (navigator.sendBeacon?.(INGEST_URI, new Blob([body], {
					type: "application/x-ndjson",
				}))) return;
			} catch {
				// A rejected beacon can still use a finite keepalive request.
			}
		}
		if (!unloading) inFlight = true;
		// Do not replay an ambiguous network failure: the server may already have
		// accepted the batch, and replaying would double page views and activity.
		void fetch(INGEST_URI, {
			method: "POST",
			mode: "same-origin",
			headers: { "Content-Type": "application/x-ndjson" },
			body,
			keepalive: true,
		}).catch(() => {}).finally(() => {
			if (unloading) return;
			inFlight = false;
			if (pendingBytes >= MAX_BATCH_BYTES) flush();
			else schedule();
		});
	}

	return {
		send(event: { event_type: string }) {
			if (paused) return;
			const line = `${JSON.stringify(event)}\n`;
			const bytes = encoder.encode(line).byteLength;
			if (bytes > MAX_BATCH_BYTES) return;
			while (pendingBytes + bytes > MAX_PENDING_BYTES) {
				pendingBytes -= pending.shift()!.bytes;
			}
			pending.push({ line, bytes });
			pendingBytes += bytes;
			if (event.event_type === "page_view" || pendingBytes >= MAX_BATCH_BYTES) flush();
			else schedule();
		},
		flush,
		pause() {
			paused = true;
			flush(true);
		},
		resume() {
			paused = false;
			flush();
		},
	};
}
