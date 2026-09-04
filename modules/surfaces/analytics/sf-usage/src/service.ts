import { createUsageServiceClient } from "g-usage";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createUsageServiceClient(createFrontNrpcClientConfig());
