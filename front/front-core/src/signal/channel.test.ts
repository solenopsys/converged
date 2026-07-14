import { describe, expect, test } from "bun:test";
import { SignalChannel } from "./channel";

class FakeSocket {
	readyState = WebSocket.CONNECTING;
	sent: string[] = [];
	onopen: WebSocket["onopen"] = null;
	onmessage: WebSocket["onmessage"] = null;
	onerror: WebSocket["onerror"] = null;
	onclose: WebSocket["onclose"] = null;

	send(data: string): void {
		this.sent.push(data);
	}

	open(): void {
		this.readyState = WebSocket.OPEN;
		this.onopen?.call(this as unknown as WebSocket, new Event("open"));
	}

	message(data: unknown): void {
		this.onmessage?.call(
			this as unknown as WebSocket,
			new MessageEvent("message", { data: JSON.stringify(data) }),
		);
	}

	close(): void {
		if (this.readyState === WebSocket.CLOSED) return;
		this.readyState = WebSocket.CLOSED;
		this.onclose?.call(this as unknown as WebSocket, new CloseEvent("close"));
	}
}

function setup() {
	const sockets: FakeSocket[] = [];
	const channel = new SignalChannel(
		() => "ws://signal.test/ws",
		() => {
			const socket = new FakeSocket();
			sockets.push(socket);
			return socket as unknown as WebSocket;
		},
		() => true,
	);
	return { channel, sockets };
}

describe("SignalChannel", () => {
	test("queues a command until the permanent socket opens", () => {
		const { channel, sockets } = setup();
		channel.send("resonus", "call.offer", { sdp: "offer" });
		expect(sockets).toHaveLength(1);
		expect(sockets[0].sent).toHaveLength(0);

		sockets[0].open();
		const command = JSON.parse(sockets[0].sent[0]);
		expect(command).toMatchObject({
			type: "command",
			target: "resonus",
			name: "call.offer",
			payload: { sdp: "offer" },
		});
		channel.disconnect();
	});

	test("correlates a response by requestId", async () => {
		const { channel, sockets } = setup();
		const responsePromise = channel.request("centimanus", "chat.message", {
			text: "hello",
		});
		sockets[0].open();
		const request = JSON.parse(sockets[0].sent[0]);
		sockets[0].message({
			type: "event",
			requestId: request.requestId,
			name: "chat.result",
			payload: { text: "world" },
		});

		expect(await responsePromise).toMatchObject({
			name: "chat.result",
			payload: { text: "world" },
		});
		channel.disconnect();
	});

	test("rejects a correlated error", async () => {
		const { channel, sockets } = setup();
		const responsePromise = channel.request("resonus", "call.offer", {});
		sockets[0].open();
		const request = JSON.parse(sockets[0].sent[0]);
		sockets[0].message({
			type: "error",
			requestId: request.requestId,
			error: { code: "scope_required", message: "scope is required" },
		});

		await expect(responsePromise).rejects.toThrow("scope is required");
		channel.disconnect();
	});

	test("rejects in-flight requests when the connection closes", async () => {
		const { channel, sockets } = setup();
		const responsePromise = channel.request("centimanus", "chat.message", {});
		sockets[0].open();
		sockets[0].close();

		await expect(responsePromise).rejects.toThrow("interrupted");
		channel.disconnect();
	});
});
