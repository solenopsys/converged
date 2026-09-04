import { createLogsServiceClient } from "g-logs";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createLogsServiceClient(createFrontNrpcClientConfig());
