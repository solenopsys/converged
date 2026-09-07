import { createCentimanusServiceClient } from "g-centimanus";
import { createFrontNrpcClientConfig } from "signal-channel";

/** The workflow runtime. rp-dag records what a run did; only this starts one. */
export default createCentimanusServiceClient(createFrontNrpcClientConfig());
