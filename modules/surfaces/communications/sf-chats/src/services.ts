import { createChatsServiceClient } from "g-chats";
import { createThreadsServiceClient } from "g-threads";
import { createFrontNrpcClientConfig } from "signal-channel";

// See the note in `sf-community/src/services.ts`: these are factories, and the
// bare-name imports that used to stand here resolved to nothing at all.
export const chatsClient = createChatsServiceClient(
	createFrontNrpcClientConfig(),
);

export const threadsClient = createThreadsServiceClient(
	createFrontNrpcClientConfig(),
);
