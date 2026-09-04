import { createSignalAssistantClient } from "assistant-state";
import { services, setStoreWorker } from "files-state";
import { createAssistantServiceClient } from "g-assistant";
import { createCentimanusServiceClient } from "g-centimanus";
import { createFilesServiceClient } from "g-files";
import { createRequestsServiceClient } from "g-requests";
import { createStoreServiceClient } from "g-store";
import { createThreadsServiceClient } from "g-threads";
import { createFrontNrpcClientConfig, signalChannel } from "signal-channel";

const chatClient = createSignalAssistantClient(signalChannel);

const centimanusClient = createCentimanusServiceClient(
	createFrontNrpcClientConfig({ deadlineMs: 120_000 }),
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
setStoreWorker(worker);

export {
	assistantClient,
	centimanusClient as dagClient,
	chatClient,
	filesClient,
	requestsClient,
	storeClient,
	threadsClient,
};
