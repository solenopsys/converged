import { createFrontNrpcClientConfig } from "signal-channel";
import { createUsageServiceClient } from "g-usage";

export default createUsageServiceClient(createFrontNrpcClientConfig());
