import { createFrontNrpcClientConfig } from "signal-channel";
import { createLogsServiceClient } from "g-logs";

export default createLogsServiceClient(createFrontNrpcClientConfig());
