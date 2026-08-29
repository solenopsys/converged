import { describe, expect, test } from "bun:test";
import type { ServiceMetadata } from "../types";
import {
	createMessagingClient,
	type WebSocketRequestMessage,
	type WebSocketResponseMessage,
} from "./messaging-client";

const metadata: ServiceMetadata = {
	serviceName: "auth",
	interfaceName: "AuthService",
	filePath: "services/auth.ts",
	types: [],
	methods: [
		{
			name: "createTemporaryUser",
			parameters: [],
			returnType: "object",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
	],
};

function createClient(target: string) {
	let request: WebSocketRequestMessage | undefined;
	const client = createMessagingClient<{
		createTemporaryUser(): Promise<Record<string, unknown>>;
	}>(metadata, {
		target,
		deadlineMs: 1_000,
		channel: {
			request: async (message): Promise<WebSocketResponseMessage> => {
				request = message;
				return { kind: "response", requestId: message.requestId, payload: {} };
			},
			requestStream: () => {
				throw new Error("stream is not used by this test");
			},
		},
	});
	return { client, request: () => request };
}

describe("browser messaging client routing", () => {
	test("routes through the configured connection target", async () => {
		const { client, request } = createClient("services");

		await client.createTemporaryUser();

		expect(request()?.to).toEqual({ target: "services", service: "auth" });
	});

	test("preserves an explicitly selected gateway target", async () => {
		const { client, request } = createClient("centimanus");

		await client.createTemporaryUser();

		expect(request()?.to).toEqual({ target: "centimanus", service: "auth" });
	});

	test("reports the application error carried in the response payload", async () => {
		const client = createMessagingClient<{
			createTemporaryUser(): Promise<Record<string, unknown>>;
		}>(metadata, {
			target: "centimanus",
			deadlineMs: 1_000,
			channel: {
				request: async (message) => ({
					kind: "error",
					requestId: message.requestId,
					errorCode: "application_error",
					payload: { error: "ServiceUnsupported" },
				}),
				requestStream: () => {
					throw new Error("stream is not used by this test");
				},
			},
		});

		await expect(client.createTemporaryUser()).rejects.toThrow(
			"ServiceUnsupported",
		);
	});
});
