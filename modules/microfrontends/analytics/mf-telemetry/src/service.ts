import { createTelemetryServiceClient } from "g-telemetry";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createTelemetryServiceClient(createFrontNrpcClientConfig());
