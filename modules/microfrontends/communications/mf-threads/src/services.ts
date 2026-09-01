import { createThreadsServiceClient } from "g-threads";
import { createFrontNrpcClientConfig } from "signal-channel";

export const threadsClient = createThreadsServiceClient(
	createFrontNrpcClientConfig(),
);
