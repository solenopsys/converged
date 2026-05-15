import { services, setStoreWorker } from "files-state";
import { createAssistantServiceClient } from "g-assistant";
import { createFilesServiceClient } from "g-files";
import { createRequestsServiceClient } from "g-requests";
import { createRuntimeAssistantServiceClient } from "g-rt-assistant";
import { createRuntimeDagServiceClient } from "g-rt-dag";
import { createStoreServiceClient } from "g-store";
import { threadsClient } from "g-threads";

const chatClient = createRuntimeAssistantServiceClient({
	baseUrl: "/runtime",
});

const dagClient = createRuntimeDagServiceClient({
	baseUrl: "/runtime",
});

const assistantClient = createAssistantServiceClient({
	baseUrl: "/services",
});

const requestsClient = createRequestsServiceClient({
	baseUrl: "/services",
});

const storeClient = createStoreServiceClient({
	baseUrl: "/services",
});

const filesClient = createFilesServiceClient({
	baseUrl: "/services",
});

services.setStoreService(storeClient);
services.setFilesService(filesClient);

// Настройка worker с правильным baseUrl
const workerUrl = new URL(
	"../../../libraries/store-workers/dist/store.worker.js",
	import.meta.url,
);
const worker = new Worker(workerUrl, { type: "module" });
setStoreWorker(worker, { baseUrl: "/services/store" });

export {
	assistantClient,
	chatClient,
	dagClient,
	filesClient,
	requestsClient,
	storeClient,
	threadsClient,
};
