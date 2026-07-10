import { createAssistantServiceClient } from "./gen/chats/generated";
import { createThreadsServiceClient } from "./gen/threads/generated";
import { createFilesServiceClient } from "./gen/files/generated";
import { createStoreServiceClient } from "./gen/store/generated";

const WORKSPACE = "club";
export const workspaceHeaders = {
  workspace: WORKSPACE,
  scope: WORKSPACE,
};

globalThis.__NRPC_CLIENT_ENV__ = {
  ...globalThis.__NRPC_CLIENT_ENV__,
  headers: {
    ...globalThis.__NRPC_CLIENT_ENV__?.headers,
    ...workspaceHeaders,
  },
};

const clientConfig = {
  baseUrl: "/services",
  headers: workspaceHeaders,
  timeout: 30000,
} as any;

export const assistantClient = createAssistantServiceClient(clientConfig);
export const threadsClient = createThreadsServiceClient(clientConfig);
export const filesClient = createFilesServiceClient(clientConfig);
export const storeClient = createStoreServiceClient(clientConfig);
