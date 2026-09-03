import { createSecretsServiceClient } from "g-secrets";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createSecretsServiceClient(createFrontNrpcClientConfig());
