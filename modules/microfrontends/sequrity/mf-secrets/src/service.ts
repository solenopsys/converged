import { createFrontNrpcClientConfig } from "signal-channel";
import { createSecretsServiceClient } from "g-secrets";

export default createSecretsServiceClient(createFrontNrpcClientConfig());
