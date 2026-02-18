import { assistantClient as generatedAssistantClient } from "g-assistant";
import { threadsClient } from "g-threads";
import { createStoreServiceClient } from "g-store";
import { createFilesServiceClient } from "g-files";
import { services, setStoreWorker } from 'files-state';
import { type ChatContext, type ChatContextSummary, type PaginatedResult, type PaginationParams } from "./types";

const callAssistant = async <T>(method: string, body: Record<string, any>): Promise<T> => {
  const response = await fetch(`/services/assistant/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

const assistantClient = {
  ...generatedAssistantClient,
  listContexts: (params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>> =>
    callAssistant("listContexts", { params }),
  getContext: (chatId: string): Promise<ChatContext | null> =>
    callAssistant("getContext", { chatId }),
  saveContext: (chatId: string, context: any): Promise<ChatContextSummary> =>
    callAssistant("saveContext", { chatId, context }),
};

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

export {assistantClient, threadsClient, storeClient, filesClient};
