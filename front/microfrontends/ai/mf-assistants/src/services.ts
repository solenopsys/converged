import { createRuntimeChatServiceClient } from "g-rt-chat";
import { createAssistantServiceClient } from "g-assistant";
import { threadsClient } from "g-threads";
import { createStoreServiceClient } from "g-store";
import { createFilesServiceClient } from "g-files";
import { services, setStoreWorker } from 'files-state';

const chatClient = createRuntimeChatServiceClient({
  baseUrl: '/runtime',
});

const assistantClient = createAssistantServiceClient({
  baseUrl: '/services',
});

const storeClient = createStoreServiceClient({
  baseUrl: '/services',
});

const filesClient = createFilesServiceClient({
  baseUrl: '/services',
});

services.setStoreService(storeClient);
services.setFilesService(filesClient);

// Настройка worker с правильным baseUrl
const workerUrl = new URL('../../../libraries/store-workers/dist/store.worker.js', import.meta.url);
const worker = new Worker(workerUrl, { type: 'module' });
setStoreWorker(worker, { baseUrl: '/services/store' });

export {chatClient, assistantClient, threadsClient, storeClient, filesClient};
