import {
	createResonusChatDriver,
	createResonusCommandTransport,
	createResonusSession,
} from "assistant-state";
import { services, setStoreWorker } from "files-state";
import { createAssistantServiceClient } from "g-assistant";
import { createContextsServiceClient } from "g-contexts";
import { createFilesServiceClient } from "g-files";
import { createRuntimeDagServiceClient } from "g-rt-dag";
import { createStoreServiceClient } from "g-store";
import { createStructServiceClient } from "g-struct";
import { createThreadsServiceClient } from "g-threads";
import { createFrontNrpcClientConfig, signalChannel } from "signal-channel";
import type { ChatConfig } from "./config";

declare global {
	var __FUJIN_WS_URL__: string | undefined;
	var __FUJIN_BROWSER_SCOPE__: string | undefined;
}

export function createServices(config: ChatConfig) {
	globalThis.__FUJIN_WS_URL__ = config.fujinWsUrl;
	signalChannel.connect();

	const resonusTransport = createResonusCommandTransport(signalChannel);
	const resonusSession = createResonusSession({
		transport: resonusTransport,
		endpoint: "fast",
	});
	// One session id for both halves of a turn: the deciding steps and the
	// streamed answer share the model binding without sharing prompts.
	const chatDriver = createResonusChatDriver({
		transport: resonusTransport,
		sessionId: resonusSession.sessionId,
		contextName: config.contextName,
		language: config.language,
	});
	const assistantClient = createAssistantServiceClient(
		createFrontNrpcClientConfig(),
	);
	const contextsClient = createContextsServiceClient(
		createFrontNrpcClientConfig(),
	);
	const structClient = createStructServiceClient(createFrontNrpcClientConfig());
	const threadsClient = createThreadsServiceClient(
		createFrontNrpcClientConfig(),
	);
	const dagClient = createRuntimeDagServiceClient(
		createFrontNrpcClientConfig({
			target: "centimanus",
			deadlineMs: 120_000,
		}),
	);

	services.setFilesService(
		createFilesServiceClient(createFrontNrpcClientConfig()),
	);
	services.setStoreService(
		createStoreServiceClient(createFrontNrpcClientConfig()),
	);

	setStoreWorker(config.createWorker());

	return {
		assistantClient,
		chatDriver,
		resonusSession,
		contextsClient,
		dagClient,
		structClient,
		threadsClient,
	};
}

export type ChatServices = ReturnType<typeof createServices>;
