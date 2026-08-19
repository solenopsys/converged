import { describe, expect, test } from "bun:test";
import { SignalChannel, type SignalAuthController } from "./channel";

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
		this.message({ type: "ready", authRequired: false });
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
	test("queues an envelope until the permanent socket opens", () => {
		const { channel, sockets } = setup();
		channel.send("resonus", "call.offer", { sdp: "offer" });
		expect(sockets).toHaveLength(1);
		expect(sockets[0].sent).toHaveLength(0);

		sockets[0].open();
		const command = JSON.parse(sockets[0].sent[0]);
		expect(command).toMatchObject({
			kind: "request",
			to: { target: "resonus", service: "resonus" },
			method: "call.offer",
			payload: { sdp: "offer" },
		});
		channel.disconnect();
	});

	test("correlates a response by requestId", async () => {
		const { channel, sockets } = setup();
		const responsePromise = channel.request("resonus", "chat.message", {
			text: "hello",
		});
		sockets[0].open();
		const request = JSON.parse(sockets[0].sent[0]);
		sockets[0].message({
			kind: "response",
			requestId: request.requestId,
			name: "chat.result",
			payload: { text: "world" },
		});

		expect(await responsePromise).toMatchObject({ payload: { text: "world" } });
		channel.disconnect();
	});

	test("unwraps a provider event carried inside the response payload", async () => {
		const { channel, sockets } = setup();
		const responsePromise = channel.request("resonus", "call.offer", {
			sdp: "offer",
		});
		sockets[0].open();
		const request = JSON.parse(sockets[0].sent[0]);
		sockets[0].message({
			kind: "response",
			requestId: request.requestId,
			payload: {
				type: "event",
				requestId: request.requestId,
				name: "call.answer",
				sessionId: "ws-1",
				payload: { sdp: "answer" },
			},
		});

		expect(await responsePromise).toMatchObject({
			name: "call.answer",
			sessionId: "ws-1",
			payload: { sdp: "answer" },
		});
		channel.disconnect();
	});

	test("rejects a correlated error", async () => {
		const { channel, sockets } = setup();
		const responsePromise = channel.request("resonus", "call.offer", {});
		sockets[0].open();
		const request = JSON.parse(sockets[0].sent[0]);
		sockets[0].message({
			kind: "error",
			requestId: request.requestId,
			error: { code: "scope_required", message: "scope is required" },
		});

		await expect(responsePromise).rejects.toThrow("scope is required");
		channel.disconnect();
	});

	test("rejects in-flight requests when the connection closes", async () => {
		const { channel, sockets } = setup();
		const responsePromise = channel.request("resonus", "chat.message", {});
		sockets[0].open();
		sockets[0].close();

		await expect(responsePromise).rejects.toThrow("interrupted");
		channel.disconnect();
	});

	test("does not release commands until required auth is acknowledged", async () => {
		const sockets: FakeSocket[] = [];
		const auth: SignalAuthController = {
			getCurrentAccessToken: () => "header.payload.signature",
			getAccessToken: async () => "header.payload.signature",
			setTokens: () => {},
			subscribe: () => () => {},
		};
		const channel = new SignalChannel(
			() => "ws://signal.test/ws",
			() => {
				const socket = new FakeSocket();
				sockets.push(socket);
				return socket as unknown as WebSocket;
			},
			() => true,
			auth,
		);
		channel.send("resonus", "call.offer", { sdp: "offer" });
		sockets[0].readyState = WebSocket.OPEN;
		sockets[0].onopen?.call(sockets[0] as unknown as WebSocket, new Event("open"));
		sockets[0].message({ type: "ready", authRequired: true });
		await Bun.sleep(0);
		expect(sockets[0].sent).toEqual([
			JSON.stringify({ type: "auth", token: "header.payload.signature" }),
		]);
		sockets[0].message({ type: "authenticated" });
		expect(JSON.parse(sockets[0].sent[1])).toMatchObject({
			kind: "request",
			method: "call.offer",
		});
		channel.disconnect();
	});

	test("does not start another session flow when auth state changes", async () => {
		const sockets: FakeSocket[] = [];
		let notifyAuth: (() => void) | undefined;
		let currentToken = "token-one";
		let tokenRequests = 0;
		const auth: SignalAuthController = {
			getCurrentAccessToken: () => currentToken,
			getAccessToken: async () => {
				tokenRequests += 1;
				return currentToken;
			},
			subscribe: (listener) => {
				notifyAuth = listener;
				return () => {};
			},
		};
		const channel = new SignalChannel(
			() => "ws://signal.test/ws",
			() => {
				const socket = new FakeSocket();
				sockets.push(socket);
				return socket as unknown as WebSocket;
			},
			() => true,
			auth,
		);

		channel.connect();
		sockets[0].open();
		sockets[0].message({ type: "ready", authRequired: true });
		await Bun.sleep(0);
		expect(tokenRequests).toBe(2);

		currentToken = "token-two";
		notifyAuth?.();
		expect(tokenRequests).toBe(2);
		expect(sockets[0].sent).toContain(
			JSON.stringify({ type: "auth", token: "token-two" }),
		);
		channel.disconnect();
	});

	test("drops the socket and token after an authentication error", () => {
		let cleared = false;
		const sockets: FakeSocket[] = [];
		const auth: SignalAuthController = {
			getCurrentAccessToken: () => "header.payload.signature",
			getAccessToken: async () => "header.payload.signature",
			setTokens: (token) => { cleared = token === null; },
			subscribe: () => () => {},
		};
		const channel = new SignalChannel(
			() => "ws://signal.test/ws",
			() => {
				const socket = new FakeSocket();
				sockets.push(socket);
				return socket as unknown as WebSocket;
			},
			() => true,
			auth,
		);

		channel.connect();
		sockets[0].open();
		sockets[0].message({ type: "auth_error", code: "unauthenticated" });

		expect(cleared).toBe(true);
		expect(sockets[0].readyState).toBe(WebSocket.CLOSED);
		channel.disconnect();
	});
});
