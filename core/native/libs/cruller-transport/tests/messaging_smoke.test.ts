import { expect, test } from "bun:test";
import { join } from "path";
import {
	MessageKind,
	MessagingConnection,
	PayloadCodec,
} from "../src/messaging";

test("Bun FFI Peer exchanges multipart messages with the Zig Router", async () => {
	const endpoint = `ipc:///tmp/cruller-transport-smoke-${process.pid}.sock`;
	const fixture = join(import.meta.dir, "../../transport/zig-out/bin/message-router-fixture");
	const server = Bun.spawn([fixture, endpoint], { stdout: "ignore", stderr: "pipe" });
	const ready = await server.stderr.getReader().read();
	expect(new TextDecoder().decode(ready.value)).toContain("ready");

	const connection = new MessagingConnection({
		endpoint,
		maxEnvelopeBytes: 4096,
		maxPayloadBytes: 1 << 20,
		recvTimeoutMs: 2000,
		sendTimeoutMs: 2000,
	});
	try {
		const payload = new TextEncoder().encode('{"hello":"world"}');
		connection.send({
			kind: MessageKind.request,
			requestId: "bun-smoke",
			to: { target: "fixture", service: "echo" },
			from: { target: "bun", service: "test" },
			method: "echo",
			codec: PayloadCodec.json,
			deadlineMs: 2000,
		}, payload);
		const response = connection.recv();
		expect(response?.envelope.kind).toBe(MessageKind.response);
		expect(response?.envelope.requestId).toBe("bun-smoke");
		expect(new TextDecoder().decode(response?.payload)).toBe('{"hello":"world"}');
	} finally {
		connection.close();
	}
	expect(await server.exited).toBe(0);
});
