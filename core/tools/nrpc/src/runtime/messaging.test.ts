import { describe, expect, test } from "bun:test";
import {
	MessageKind,
	PayloadCodec,
	type IncomingMessage,
	type MessageEnvelope,
} from "bun-transport/messaging";
import type { ServiceMetadata } from "../types";
import { createMessagingBackend } from "./messaging-backend";
import { createZmqClient } from "./zmq-client";
import {
	type MessagingChannel,
	NrpcMessagingRuntime,
} from "./messaging-runtime";
import { getCurrentWorkspaceContext } from "./workspace-context";

const metadata: ServiceMetadata = {
	serviceName: "echo",
	interfaceName: "EchoService",
	filePath: "echo.ts",
	types: [],
	methods: [
		{
			name: "inspect",
			parameters: [{ name: "value", type: "string", optional: false, isArray: false }],
			returnType: "object",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "count",
			parameters: [{ name: "limit", type: "number", optional: false, isArray: false }],
			returnType: "number",
			isAsync: false,
			returnTypeIsArray: false,
			isAsyncIterable: true,
		},
	],
};

class MemoryChannel implements MessagingChannel {
	peer?: MemoryChannel;
	inbox: IncomingMessage[] = [];
	registration?: { target: string };

	declareTarget(target: string): void {
		this.registration = { target };
	}

	send(envelope: MessageEnvelope, payload = new Uint8Array()): void {
		if (!this.peer) throw new Error("memory channel is disconnected");
		this.peer.inbox.push({ envelope: normalizeEnvelope(envelope), payload: payload.slice() });
	}

	recvNowait(): IncomingMessage | null {
		return this.inbox.shift() ?? null;
	}

	close(): void {}
}

function channelPair(): [MemoryChannel, MemoryChannel] {
	const left = new MemoryChannel();
	const right = new MemoryChannel();
	left.peer = right;
	right.peer = left;
	return [left, right];
}

function normalizeEnvelope(envelope: MessageEnvelope): IncomingMessage["envelope"] {
	return {
		version: envelope.version ?? 1,
		kind: envelope.kind,
		requestId: envelope.requestId ?? "",
		to: { target: envelope.to?.target ?? "", service: envelope.to?.service ?? "" },
		from: { target: envelope.from?.target ?? "", service: envelope.from?.service ?? "" },
		method: envelope.method ?? "",
		scope: envelope.scope ?? "",
		user: envelope.user ?? "",
		auth: envelope.auth ?? "",
		codec: envelope.codec ?? PayloadCodec.json,
		seq: envelope.seq ?? 0,
		fin: envelope.fin ?? false,
		deadlineMs: envelope.deadlineMs ?? 0,
		errorCode: envelope.errorCode ?? "",
	};
}

async function drive<T>(promise: Promise<T>, runtimes: NrpcMessagingRuntime[]): Promise<T> {
	let settled = false;
	const tracked = promise.finally(() => { settled = true; });
	for (let index = 0; index < 100 && !settled; index++) {
		for (const runtime of runtimes) runtime.poll();
		await Bun.sleep(0);
	}
	if (!settled) throw new Error("messaging test did not settle");
	return tracked;
}

describe("nrpc messaging runtime", () => {
	test("dispatches regular and streaming calls with scope context", async () => {
		const [clientChannel, serverChannel] = channelPair();
		const clientRuntime = new NrpcMessagingRuntime({
			connection: clientChannel,
			target: "caller",
			pollIntervalMs: 1000,
			maxMessagesPerPoll: 32,
		});
		const serverRuntime = new NrpcMessagingRuntime({
			connection: serverChannel,
			target: "core",
			pollIntervalMs: 1000,
			maxMessagesPerPoll: 32,
		});

		createMessagingBackend({
			runtime: serverRuntime,
			metadata,
			serviceImpl: {
				inspect(value: string) {
					return { value, scope: getCurrentWorkspaceContext()?.scope, auth: getCurrentWorkspaceContext()?.auth };
				},
				async *count(limit: number) {
					for (let index = 1; index <= limit; index++) yield index;
				},
			},
		});
		await serverRuntime.start();
		await clientRuntime.start();
		expect(serverChannel.registration).toEqual({ target: "core" });
		expect(clientChannel.registration).toEqual({ target: "caller" });

		const client = createZmqClient<{
			inspect(value: string): Promise<{ value: string; scope: string; auth: string }>;
			count(limit: number): AsyncIterable<number>;
		}>(metadata, {
			runtime: clientRuntime,
			target: "core",
			deadlineMs: 2000,
			scope: "tenant-a",
			auth: "session.jwt",
		});

		const inspected = await drive(client.inspect("hello"), [serverRuntime, clientRuntime]);
		expect(inspected).toEqual({ value: "hello", scope: "tenant-a", auth: "session.jwt" });

		const iterator = client.count(3)[Symbol.asyncIterator]();
		expect((await drive(iterator.next(), [serverRuntime, clientRuntime])).value).toBe(1);
		expect((await drive(iterator.next(), [serverRuntime, clientRuntime])).value).toBe(2);
		expect((await drive(iterator.next(), [serverRuntime, clientRuntime])).value).toBe(3);
		expect((await drive(iterator.next(), [serverRuntime, clientRuntime])).done).toBe(true);

		await clientRuntime.close();
		await serverRuntime.close();
	});

	// Two runtimes under one target register two ZMQ identities for one name in
	// fujin; the last one wins and quietly receives the other's replies, whose
	// requests then only ever time out. Fail at start() instead.
	test("refuses a second runtime for a target already live in this process", async () => {
		const first = new NrpcMessagingRuntime({
			connection: channelPair()[0],
			target: "duplicate-target",
			pollIntervalMs: 1000,
			maxMessagesPerPoll: 32,
		});
		const second = new NrpcMessagingRuntime({
			connection: channelPair()[0],
			target: "duplicate-target",
			pollIntervalMs: 1000,
			maxMessagesPerPoll: 32,
		});

		await first.start();
		expect(second.start()).rejects.toThrow(/already registered in this process/);

		// The target frees up once its owner shuts down.
		await first.close();
		await second.start();
		await second.close();
	});

	test("accepts a service registered after target startup", async () => {
		const channel = channelPair()[0];
		const runtime = new NrpcMessagingRuntime({
			connection: channel,
			target: "late-service-owner",
			pollIntervalMs: 1000,
			maxMessagesPerPoll: 32,
		});

		await runtime.start();
		createMessagingBackend({
			runtime,
			metadata,
			serviceImpl: { inspect: () => ({ ok: true }) },
		});

		await runtime.close();
	});
});
