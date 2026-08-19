import { createSignalAssistantClient } from "assistant-state";
import { services, setStoreWorker } from "files-state";
import { createAssistantServiceClient } from "g-assistant";
import { createFilesServiceClient } from "g-files";
import { createRequestsServiceClient } from "g-requests";
import { createRuntimeDagServiceClient } from "g-rt-dag";
import { createStoreServiceClient } from "g-store";
import { createThreadsServiceClient } from "g-threads";
import {
	createFrontNrpcClientConfig,
	defaultSignalUrl,
	signalChannel,
} from "signal-channel";

declare global {
	var __FUJIN_BROWSER_SCOPE__: string | undefined;
}

const chatClient = createSignalAssistantClient(signalChannel);

const browserScope = globalThis.__FUJIN_BROWSER_SCOPE__?.trim();
if (!browserScope) {
	throw new Error("Missing required FUJIN_BROWSER_SCOPE browser bootstrap");
}

const dagClient = createRuntimeDagServiceClient(
	createFrontNrpcClientConfig({
		target: "centimanus",
		deadlineMs: 120_000,
	}),
);
const assistantClient = createAssistantServiceClient(
	createFrontNrpcClientConfig(),
);
const requestsClient = createRequestsServiceClient(
	createFrontNrpcClientConfig(),
);
const threadsClient = createThreadsServiceClient(createFrontNrpcClientConfig());
const storeClient = createStoreServiceClient(createFrontNrpcClientConfig());
const filesClient = createFilesServiceClient(createFrontNrpcClientConfig());

services.setStoreService(storeClient);
services.setFilesService(filesClient);

const workerUrl = new URL(
	"../../../../libraries/store-workers/dist/store.worker.js",
	import.meta.url,
);
const worker = new Worker(workerUrl, { type: "module" });
setStoreWorker(worker, {
	baseUrl: "/",
	fujinWsUrl: defaultSignalUrl(),
	headers: { "X-Storage-Scope": browserScope },
});

export {
	assistantClient,
	chatClient,
	dagClient,
	filesClient,
	requestsClient,
	storeClient,
	threadsClient,
};
