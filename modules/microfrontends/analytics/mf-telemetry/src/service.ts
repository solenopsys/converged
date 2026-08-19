import { createFrontNrpcClientConfig } from "signal-channel";
import { createTelemetryServiceClient } from "g-telemetry";

export default createTelemetryServiceClient(createFrontNrpcClientConfig());
