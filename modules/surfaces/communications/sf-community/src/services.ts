import { createCommunityServiceClient } from "g-community";
import { createThreadsServiceClient } from "g-threads";
import { createFrontNrpcClientConfig } from "signal-channel";

// The generated packages export factories, not ready clients: a client needs a
// transport config, and there is exactly one right answer for a browser. The
// previous `import { communityClient } from "g-community"` named an export that
// does not exist, which a bundler drops silently — leaving calls to an
// undeclared variable and a `ReferenceError` on first use.
export const communityClient = createCommunityServiceClient(
	createFrontNrpcClientConfig(),
);

// The browser talks to `rp-threads` directly and keeps doing so. A thread
// guards itself; proxying reads through the topic's owner would be one
// repository calling another, which is the thing the architecture forbids.
export const threadsClient = createThreadsServiceClient(
	createFrontNrpcClientConfig(),
);
